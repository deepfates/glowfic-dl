import { describe, it, expect } from "vitest";

import { makeFilenameValidForEpub3 } from "../src/util.ts";

function byteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

describe("makeFilenameValidForEpub3", () => {
  it("passes through a typical safe filename unchanged", () => {
    const input = "My book title 2024 – edition v2.pdf";
    const out = makeFilenameValidForEpub3(input);
    expect(out).toBe(input);
  });

  it("removes banned ASCII characters and DEL", () => {
    // Includes: / \ " : < > ? | and DEL (\u007f)
    const input = 'bad/\\":<>?|\u007fname.txt';
    const out = makeFilenameValidForEpub3(input);
    expect(out).toBe("badname.txt");
  });

  it("trims trailing periods", () => {
    expect(makeFilenameValidForEpub3("Document...")).toBe("Document");
    expect(makeFilenameValidForEpub3("a.b....")).toBe("a.b");
  });

  it("throws when everything is filtered away or only periods remain", () => {
    expect(() => makeFilenameValidForEpub3("....")).toThrow(
      /only invalid characters and\/or periods/i,
    );
    expect(() => makeFilenameValidForEpub3('/\\":<>?|\u007f')).toThrow(
      /only invalid characters and\/or periods/i,
    );
  });

  it("truncates long filenames to <= 255 bytes while retaining extension", () => {
    const longName = "a".repeat(300) + ".json";
    const out = makeFilenameValidForEpub3(longName);

    expect(out.endsWith(".json")).toBe(true);
    expect(byteLen(out)).toBeLessThanOrEqual(255);
    expect(out.length).toBeLessThan(longName.length);
    // Should still be many 'a's
    expect(out.replace(/\.json$/, "")).toMatch(/^a+$/);
  });

  it("throws when the extension alone exceeds 254 bytes", () => {
    const tooLongExt = "a".repeat(255);
    const input = `file.${tooLongExt}`;
    expect(() => makeFilenameValidForEpub3(input)).toThrow(/extension longer than 254 bytes/i);
  });

  it("removes disallowed control and private-use characters from ranges", () => {
    // \u0001 (C0 control) and \uE000 (private use)
    const input = "Normal\u0001Name\uE000.txt";
    const out = makeFilenameValidForEpub3(input);
    expect(out).toBe("NormalName.txt");
  });

  it("preserves valid multi-byte characters (e.g., emoji)", () => {
    const input = "file😀.txt";
    const out = makeFilenameValidForEpub3(input);
    expect(out).toBe(input);
  });

  // NOTE: Asterisk (*) is typically disallowed in filenames on many systems.
  // This test is left as a TODO to verify it is filtered. If it fails,
  // implementation should add '*' to the banned character set.
  it.todo("removes asterisk (*) as an invalid character");
});
