const FILENAME_BANNED_CHARS = '/\\\"*:<>?|\\u007f';

const FILENAME_BANNED_CHAR_RANGES: Array<[number, number]> = [
  [0x0000, 0x001f],
  [0x0080, 0x009f],
  [0xe000, 0xf8ff],
  [0xfdd0, 0xfdef],
  [0xfff0, 0xffff],
  [0xe0000, 0xe0fff],
  [0xf0000, 0xfffff],
  [0x100000, 0x10ffff]
];

export function makeFilenameValidForEpub3(filename: string): string {
  let filtered = "";
  for (const ch of filename) {
    if (FILENAME_BANNED_CHARS.includes(ch)) continue;
    const code = ch.codePointAt(0)!;
    let allowed = true;
    for (const [lo, hi] of FILENAME_BANNED_CHAR_RANGES) {
      if (code >= lo && code <= hi) {
        allowed = false;
        break;
      }
    }
    if (allowed) filtered += ch;
  }
  while (filtered.length > 0 && filtered.endsWith(".")) {
    filtered = filtered.slice(0, -1);
  }
  if (filtered.length === 0) {
    throw new Error(
      "Attempted to put file into EPUB with filename containing only invalid characters and/or periods."
    );
  }
  const encoder = new TextEncoder();
  if (encoder.encode(filtered).length <= 255) return filtered;
  const lastDot = filtered.lastIndexOf(".");
  const ext = lastDot >= 0 ? filtered.slice(lastDot + 1) : "";
  const name = lastDot >= 0 ? filtered.slice(0, lastDot) : filtered;
  if (new TextEncoder().encode(ext).length > 254) {
    throw new Error("Attempted to put file into EPUB with extension longer than 254 bytes.");
  }
  let nameTrunc = name;
  let candidate = ext ? `${nameTrunc}.${ext}` : nameTrunc;
  while (encoder.encode(candidate).length > 255 && nameTrunc.length > 0) {
    nameTrunc = nameTrunc.slice(0, -1);
    candidate = ext ? `${nameTrunc}.${ext}` : nameTrunc;
  }
  return candidate;
}
