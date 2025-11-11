import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/fetch.js", () => ({
  getText: vi.fn(),
}));

import * as fetchMod from "../src/fetch.js";
import { fetchStructure } from "../src/index.ts";
import { parseThread } from "../src/parse.ts";

describe("HTTP error paths for thread parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parseThread propagates HTTP failure from getText", async () => {
    const url = "https://glowfic.com/posts/777";
    const mockedGetText = fetchMod.getText as unknown as vi.Mock;
    mockedGetText.mockRejectedValue(new Error(`GET ${url} failed: 500 Internal Server Error`));

    await expect(parseThread(url)).rejects.toThrow(/failed/i);
    await expect(parseThread(url)).rejects.toThrow(/777/);
  });

  it("fetchStructure propagates HTTP failure for post URLs", async () => {
    const url = "https://glowfic.com/posts/888";
    const mockedGetText = fetchMod.getText as unknown as vi.Mock;
    mockedGetText.mockRejectedValue(new Error(`GET ${url} failed: 404 Not Found`));

    await expect(fetchStructure(url)).rejects.toThrow(/404/);
    await expect(fetchStructure(url)).rejects.toThrow(/888/);
  });
});
