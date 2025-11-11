import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach } from "vitest";

// IMPORTANT: mock must come before importing the module under test
vi.mock("../src/fetch.js", () => ({
  getText: vi.fn(),
}));

// Import after mocks so parseThread uses the mocked getText
import * as fetchMod from "../src/fetch.js";
import { parseThread } from "../src/parse.ts";

function readFixture(name: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const p = path.resolve(__dirname, "fixtures", name);
  return readFileSync(p, { encoding: "utf-8" });
}

describe("parseThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses a simple thread into the expected structure", async () => {
    const html = readFixture("thread-simple.html");

    const mockedGetText = fetchMod.getText as unknown as vi.Mock;
    mockedGetText.mockResolvedValueOnce(html);

    const url = "https://glowfic.com/posts/9999";
    const thread = await parseThread(url);

    // Thread-level assertions
    expect(thread.id).toBe("9999");
    expect(thread.title).toBe("Sample Thread Title");
    expect(thread.url).toBe(url);
    expect(thread.description).toBe("A simple thread used for parser tests.");
    expect(thread.posts).toHaveLength(2);
    expect(thread.authors.sort()).toEqual(["Author One", "Author Two"].sort());

    // First post assertions (with explicit id and relative icon)
    const p1 = thread.posts[0];
    expect(p1.post_id).toBe("post-1001");
    expect(p1.author).toBe("Author One");
    expect(p1.character_display_name).toBe("Character One");
    expect(p1.character_handle).toBe("@charone");
    expect(p1.icon_url).toBe("https://glowfic.com/icons/char1.png"); // relative -> absolute
    expect(p1.timestamp).toBe("2021-01-01T12:00:00Z");
    expect(p1.content).toContain("Hello world. This is the first post.");
    expect(p1.content).toContain('class="post-content"'); // full div preserved

    // Second post assertions (no id attr; permalink-derived id and absolute icon already)
    const p2 = thread.posts[1];
    expect(p2.post_id).toBe("reply-1002");
    expect(p2.author).toBe("Author Two");
    expect(p2.character_display_name).toBe("Character Two");
    expect(p2.character_handle).toBe("@chartwo");
    expect(p2.icon_url).toBe("https://cdn.example.com/icons/char2.jpg");
    expect(p2.timestamp).toBe("2021-01-02 08:30:00 UTC"); // from abbr[title]
    expect(p2.content).toContain("Replying with some content");
  });

  it("gracefully handles missing optional fields", async () => {
    // Minimal HTML with one post and many fields missing
    const html = `
      <html>
        <head><title>Fallback Title</title></head>
        <body>
          <table><tr><th class="table-title"></th></tr></table>
          <div class="post-container" id="post-42">
            <div class="post-content"><p>Just content.</p></div>
          </div>
        </body>
      </html>
    `;

    const mockedGetText = fetchMod.getText as unknown as vi.Mock;
    mockedGetText.mockResolvedValueOnce(html);

    const url = "https://glowfic.com/posts/42";
    const thread = await parseThread(url);

    expect(thread.id).toBe("42");
    // No table title text -> falls back to <title>
    expect(thread.title).toBe("Fallback Title");
    expect(thread.description).toBeNull();

    expect(thread.posts).toHaveLength(1);
    const p = thread.posts[0];
    expect(p.post_id).toBe("post-42");
    expect(p.author).toBeNull();
    expect(p.character_display_name).toBeNull();
    expect(p.character_handle).toBeNull();
    expect(p.icon_url).toBeNull();
    expect(p.timestamp).toBeNull();
    expect(p.content).toContain("Just content.");
  });
});
