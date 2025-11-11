import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

// IMPORTANT: mock must come before importing the module under test
vi.mock("../src/fetch.js", () => ({
  getText: vi.fn(),
}));

// Import after mocks so parseSection uses the mocked getText (section HTML is inlined)
import * as fetchMod from "../src/fetch.js";
import { parseSection } from "../src/parse.ts";

function readFixture(name: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const p = path.resolve(__dirname, "fixtures", name);
  return readFileSync(p, { encoding: "utf-8" });
}

describe("parseSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses a section page and fetches linked threads", async () => {
    const sectionUrl = "https://glowfic.com/board_sections/703";

    // Inline simple section HTML with title, description, and two thread links
    const sectionHtml = `
      <!doctype html>
      <html>
        <head><title>Ignored</title></head>
        <body>
          <table>
            <tr><th class="table-title">My Section</th></tr>
            <tr><td class="written-content">Desc text.</td></tr>
          </table>
          <table>
            <tr><td class="post-subject"><a href="/posts/1001">Thread One</a></td></tr>
            <tr><td class="post-subject"><a href="/posts/1002">Thread Two</a></td></tr>
          </table>
        </body>
      </html>
    `;

    // Use the same thread fixture for both linked threads
    const threadHtml = readFixture("thread-simple.html");

    const mockedGetText = fetchMod.getText as unknown as vi.Mock;

    mockedGetText.mockImplementation((url: string) => {
      if (url.includes("/board_sections/703")) {
        return Promise.resolve(sectionHtml);
      }
      if (url.includes("/posts/1001")) {
        return Promise.resolve(threadHtml);
      }
      if (url.includes("/posts/1002")) {
        return Promise.resolve(threadHtml);
      }
      return Promise.reject(new Error(`Unexpected URL in test: ${url}`));
    });

    const section = await parseSection(sectionUrl);

    expect(section.id).toBe("703");
    expect(section.title).toBe("My Section");
    expect(section.description).toBe("Desc text.");
    expect(section.threads).toHaveLength(2);

    const t1 = section.threads[0];
    const t2 = section.threads[1];

    expect(t1.id).toBe("1001");
    expect(t2.id).toBe("1002");
    expect(typeof t1.title).toBe("string");
    expect(t1.title.length).toBeGreaterThan(0);
    expect(typeof t2.title).toBe("string");
    expect(t2.title.length).toBeGreaterThan(0);
  });

  it("sets title and description to null when missing on the section page", async () => {
    const sectionUrl = "https://glowfic.com/board_sections/42";

    // Title cell intentionally empty, no written-content cell
    const sectionHtml = `
      <!doctype html>
      <html>
        <head><title>Ignored</title></head>
        <body>
          <table>
            <tr><th class="table-title"></th></tr>
          </table>
          <table>
            <tr><td class="post-subject"><a href="/posts/2001">Thread A</a></td></tr>
          </table>
        </body>
      </html>
    `;

    const threadHtml = readFixture("thread-simple.html");
    const mockedGetText = fetchMod.getText as unknown as vi.Mock;

    mockedGetText.mockImplementation((url: string) => {
      if (url.includes("/board_sections/42")) {
        return Promise.resolve(sectionHtml);
      }
      if (url.includes("/posts/2001")) {
        return Promise.resolve(threadHtml);
      }
      return Promise.reject(new Error(`Unexpected URL in test: ${url}`));
    });

    const section = await parseSection(sectionUrl);
    expect(section.id).toBe("42");
    expect(section.title).toBeNull();
    expect(section.description).toBeNull();
    expect(section.threads).toHaveLength(1);
    expect(section.threads[0].id).toBe("2001");
  });

  it("propagates an error when a linked thread fails to fetch", async () => {
    const sectionUrl = "https://glowfic.com/board_sections/9";

    const sectionHtml = `
      <!doctype html>
      <html>
        <head><title>Ignored</title></head>
        <body>
          <table>
            <tr><th class="table-title">Err Section</th></tr>
            <tr><td class="written-content">Has a failing thread.</td></tr>
          </table>
          <table>
            <tr><td class="post-subject"><a href="/posts/3001">OK Thread</a></td></tr>
            <tr><td class="post-subject"><a href="/posts/3002">Failing Thread</a></td></tr>
          </table>
        </body>
      </html>
    `;

    const okThreadHtml = readFixture("thread-simple.html");
    const mockedGetText = fetchMod.getText as unknown as vi.Mock;

    mockedGetText.mockImplementation((url: string) => {
      if (url.includes("/board_sections/9")) {
        return Promise.resolve(sectionHtml);
      }
      if (url.includes("/posts/3001")) {
        return Promise.resolve(okThreadHtml);
      }
      if (url.includes("/posts/3002")) {
        return Promise.reject(new Error("Simulated fetch failure for thread 3002"));
      }
      return Promise.reject(new Error(`Unexpected URL in test: ${url}`));
    });

    await expect(parseSection(sectionUrl)).rejects.toThrow(/3002/);
  });
});
