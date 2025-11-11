import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the API used by the CLI to avoid network
vi.mock("../src/index.ts", () => ({
  fetchThread: vi.fn(),
  fetchSection: vi.fn(),
  fetchBoard: vi.fn(),
  fetchStructure: vi.fn(),
}));

import { runCli } from "../src/cli.ts";
import * as api from "../src/index.ts";

type Mock = ReturnType<typeof vi.fn>;

async function makeTmpDir(prefix = "glowfic-dl-cli-"): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return dir;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(p: string): Promise<T> {
  const s = await fs.readFile(p, "utf8");
  return JSON.parse(s) as T;
}

async function withCapturedStdout<T>(fn: () => Promise<T>): Promise<{ output: string; value: T }> {
  const origWrite = process.stdout.write as typeof process.stdout.write;
  let buf = "";
  (process.stdout.write as any) = (chunk: any) => {
    buf += typeof chunk === "string" ? chunk : String(chunk);
    return true;
  };
  try {
    const value = await fn();
    return { output: buf, value };
  } finally {
    // restore
    (process.stdout.write as unknown as typeof process.stdout.write) = origWrite;
  }
}

describe("CLI E2E (mocked API)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prints a single thread to stdout", async () => {
    const thread = {
      id: "1",
      title: "A Thread",
      url: "https://glowfic.com/posts/1",
      description: null,
      posts: [],
      authors: [],
    };
    (api.fetchThread as unknown as Mock).mockResolvedValueOnce(thread);

    const { output } = await withCapturedStdout(async () => {
      await runCli(["https://glowfic.com/posts/1", "--stdout"]);
    });

    // CLI writes exactly one JSON line for stdout mode
    const line = output.trimEnd().split("\n").at(-1) ?? "";
    const parsed = JSON.parse(line);
    expect(parsed.id).toBe("1");
    expect(parsed.title).toBe("A Thread");
    expect(api.fetchThread).toHaveBeenCalledTimes(1);
  });

  it("writes a single thread to a specific file with --force", async () => {
    const tmp = await makeTmpDir();
    const outPath = path.join(tmp, "thread.json");

    const thread = {
      id: "42",
      title: "Meaning",
      url: "https://glowfic.com/posts/42",
      description: null,
      posts: [
        {
          post_id: "post-42",
          author: "Ada",
          character_display_name: null,
          character_handle: null,
          icon_url: null,
          timestamp: null,
          content: "<p>Hi</p>",
        },
      ],
      authors: ["Ada"],
    };
    (api.fetchThread as unknown as Mock).mockResolvedValueOnce(thread);

    await runCli(["https://glowfic.com/posts/42", "-o", outPath, "--force"]);
    expect(await pathExists(outPath)).toBe(true);

    const data = await readJson<typeof thread>(outPath);
    expect(data.id).toBe("42");
    expect(data.title).toBe("Meaning");
    expect(api.fetchThread).toHaveBeenCalledTimes(1);
  });

  it("refuses to overwrite without --force, then succeeds with --force", async () => {
    const tmp = await makeTmpDir();
    const outPath = path.join(tmp, "repeat.json");
    await fs.writeFile(outPath, '{"hello":"world"}', "utf8");

    const thread = {
      id: "7",
      title: "Seventh",
      url: "https://glowfic.com/posts/7",
      description: null,
      posts: [],
      authors: [],
    };
    (api.fetchThread as unknown as Mock).mockResolvedValue(thread);

    // Without --force should reject
    await expect(runCli(["https://glowfic.com/posts/7", "-o", outPath])).rejects.toThrow(
      /Refusing to overwrite/i,
    );
    // With --force should succeed
    await runCli(["https://glowfic.com/posts/7", "-o", outPath, "--force"]);

    const data = await readJson<typeof thread>(outPath);
    expect(data.id).toBe("7");
  });

  it("handles --dry-run with multiple URLs and --output-dir without hitting network", async () => {
    const tmp = await makeTmpDir();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCli([
      "https://glowfic.com/posts/5506",
      "https://glowfic.com/board_sections/703",
      "--output-dir",
      tmp,
      "--dry-run",
    ]);

    // Expected dry-run messages
    const msgs = logSpy.mock.calls.map((c) => String(c[0]));
    expect(msgs.some((m) => m.includes("[dry-run] https://glowfic.com/posts/5506 -> "))).toBe(true);
    expect(msgs.some((m) => m.includes(path.join(tmp, "thread-5506.json")))).toBe(true);
    expect(
      msgs.some((m) => m.includes("[dry-run] https://glowfic.com/board_sections/703 -> ")),
    ).toBe(true);
    expect(msgs.some((m) => m.includes(path.join(tmp, "section-703.json")))).toBe(true);

    // No network calls in dry-run
    expect(api.fetchThread).not.toHaveBeenCalled();
    expect(api.fetchSection).not.toHaveBeenCalled();
    expect(api.fetchBoard).not.toHaveBeenCalled();
    expect(api.fetchStructure).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("autodetects unknown URL via fetchStructure and writes to output-dir", async () => {
    const tmp = await makeTmpDir();

    const board = {
      id: "215",
      title: "My Board Title",
      description: null,
      sections: [],
      threads: [],
    };
    (api.fetchStructure as unknown as Mock).mockResolvedValueOnce({ kind: "board", board });

    await runCli(["https://glowfic.com/whatever/abc", "--output-dir", tmp, "--force"]);

    // File named by title.json inside tmp
    const expectedName = "My Board Title.json";
    const candidatePath = path.join(tmp, expectedName);
    expect(await pathExists(candidatePath)).toBe(true);

    const data = await readJson<typeof board>(candidatePath);
    expect(data.id).toBe("215");
    expect(data.title).toBe("My Board Title");
    expect(api.fetchStructure).toHaveBeenCalledTimes(1);
  });

  it("processes multiple URLs concurrently and writes to output-dir", async () => {
    const tmp = await makeTmpDir();

    (api.fetchThread as unknown as Mock).mockImplementation(async (url: string) => {
      const id = url.split("/").pop() ?? "x";
      return { id, title: `Thread #${id}`, url, description: null, posts: [], authors: [] };
    });

    await runCli([
      "https://glowfic.com/posts/1001",
      "https://glowfic.com/posts/1002",
      "--output-dir",
      tmp,
      "--concurrency",
      "2",
      "--force",
    ]);

    const f1 = path.join(tmp, "Thread #1001.json");
    const f2 = path.join(tmp, "Thread #1002.json");
    expect(await pathExists(f1)).toBe(true);
    expect(await pathExists(f2)).toBe(true);

    const j1 = await readJson<{ id: string }>(f1);
    const j2 = await readJson<{ id: string }>(f2);
    expect(j1.id).toBe("1001");
    expect(j2.id).toBe("1002");
    expect((api.fetchThread as unknown as Mock).mock.calls.length).toBe(2);
  });
});
