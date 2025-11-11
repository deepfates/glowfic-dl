import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

// IMPORTANT: mock must come before importing the module under test
vi.mock("../src/fetch.js", () => ({
  getText: vi.fn(),
}));

// Import after mocks so parseBoard uses the mocked getText
import * as fetchMod from "../src/fetch.js";
import { parseBoard } from "../src/parse.ts";

function readFixture(name: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const p = path.resolve(__dirname, "fixtures", name);
  return readFileSync(p, { encoding: "utf-8" });
}

describe("parseBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses a board with two sections and two threads", async () => {
    const boardUrl = "https://glowfic.com/boards/215";

    // Minimal HTML that matches parseBoard's expectations:
    // - th.table-title (board title)
    // - #content tr rows with:
    //   - th.continuity-header (section header)
    //   - td.written-content (section description)
    //   - td.post-subject a (thread links)
    //   - td.continuity-spacer (separator between sections)
    const boardHtml = `
      <!doctype html>
      <html>
        <head><title>Ignored</title></head>
        <body>
          <table>
            <tr><th class="table-title">Sample Board Title</th></tr>
          </table>

          <table id="content">
            <!-- Section 1 -->
            <tr><th class="continuity-header">Section One</th></tr>
            <tr><td class="written-content">First section description.</td></tr>
            <tr><td class="post-subject"><a href="/posts/4001">First Thread</a></td></tr>

            <!-- Spacer -->
            <tr><td class="continuity-spacer"></td></tr>

            <!-- Section 2 -->
            <tr><th class="continuity-header">Section Two</th></tr>
            <tr><td class="written-content">Second section description.</td></tr>
            <tr><td class="post-subject"><a href="/posts/4002">Second Thread</a></td></tr>
          </table>
        </body>
      </html>
    `;

    // Reuse the thread fixture used elsewhere
    const threadHtml = readFixture("thread-simple.html");

    const mockedGetText = fetchMod.getText as unknown as vi.Mock;
    mockedGetText.mockImplementation((url: string) => {
      if (url.includes("/boards/215")) return Promise.resolve(boardHtml);
      if (url.includes("/posts/4001")) return Promise.resolve(threadHtml);
      if (url.includes("/posts/4002")) return Promise.resolve(threadHtml);
      return Promise.reject(new Error(`Unexpected URL in test: ${url}`));
    });

    const board = await parseBoard(boardUrl);

    // Board-level assertions
    expect(board.id).toBe("215");
    expect(board.title).toBe("Sample Board Title");
    // Board description is not parsed; implementation returns null
    expect(board.description).toBeNull();

    // Sections
    expect(board.sections).toHaveLength(2);
    expect(board.sections[0].title).toBe("Section One");
    expect(board.sections[0].description).toBe("First section description.");
    expect(board.sections[0].threads).toHaveLength(1);

    expect(board.sections[1].title).toBe("Section Two");
    expect(board.sections[1].description).toBe("Second section description.");
    expect(board.sections[1].threads).toHaveLength(1);

    // Flattened threads convenience array
    expect(board.threads).toHaveLength(2);
    // parseThread infers id from the URL path; our links are /posts/4001 and /posts/4002
    const ids = board.threads.map((t) => t.id).sort();
    expect(ids).toEqual(["4001", "4002"]);
  });

  it("falls back to <title> when th.table-title is missing", async () => {
    const boardUrl = "https://glowfic.com/boards/999";

    const boardHtml = `
      <!doctype html>
      <html>
        <head><title>Fallback Board Title</title></head>
        <body>
          <table id="content">
            <tr><th class="continuity-header">Only Section</th></tr>
            <tr><td class="post-subject"><a href="/posts/5001">Lone Thread</a></td></tr>
          </table>
        </body>
      </html>
    `;

    const threadHtml = readFixture("thread-simple.html");

    const mockedGetText = fetchMod.getText as unknown as vi.Mock;
    mockedGetText.mockImplementation((url: string) => {
      if (url.includes("/boards/999")) return Promise.resolve(boardHtml);
      if (url.includes("/posts/5001")) return Promise.resolve(threadHtml);
      return Promise.reject(new Error(`Unexpected URL in test: ${url}`));
    });

    const board = await parseBoard(boardUrl);

    expect(board.id).toBe("999");
    expect(board.title).toBe("Fallback Board Title");
    expect(board.description).toBeNull();
    expect(board.sections).toHaveLength(1);
    expect(board.sections[0].threads).toHaveLength(1);
    expect(board.threads).toHaveLength(1);
    expect(board.threads[0].id).toBe("5001");
  });

  it("propagates an error when a linked thread fails to fetch", async () => {
    const boardUrl = "https://glowfic.com/boards/123";

    const boardHtml = `
      <!doctype html>
      <html>
        <head><title>Board With Error</title></head>
        <body>
          <table id="content">
            <tr><th class="continuity-header">Section A</th></tr>
            <tr><td class="post-subject"><a href="/posts/6001">OK Thread</a></td></tr>
            <tr><td class="continuity-spacer"></td></tr>
            <tr><th class="continuity-header">Section B</th></tr>
            <tr><td class="post-subject"><a href="/posts/6002">Failing Thread</a></td></tr>
          </table>
        </body>
      </html>
    `;

    const okThreadHtml = readFixture("thread-simple.html");

    const mockedGetText = fetchMod.getText as unknown as vi.Mock;
    mockedGetText.mockImplementation((url: string) => {
      if (url.includes("/boards/123")) return Promise.resolve(boardHtml);
      if (url.includes("/posts/6001")) return Promise.resolve(okThreadHtml);
      if (url.includes("/posts/6002"))
        return Promise.reject(new Error("Simulated fetch failure for thread 6002"));
      return Promise.reject(new Error(`Unexpected URL in test: ${url}`));
    });

    await expect(parseBoard(boardUrl)).rejects.toThrow(/6002/);
  });
});
