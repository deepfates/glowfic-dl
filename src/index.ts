export {
  parseThread as fetchThread,
  parseSection as fetchSection,
  parseBoard as fetchBoard,
} from "./parse.js";
export * from "./types.js";
import { parseBoard, parseSection, parseThread } from "./parse.js";
import type { BookStructure } from "./types.js";

export async function fetchStructure(url: string): Promise<BookStructure> {
  if (/\/posts\//.test(url)) {
    const thread = await parseThread(url);
    return { kind: "thread", thread };
  }
  if (/\/board_sections\//.test(url)) {
    const section = await parseSection(url);
    return { kind: "section", section };
  }
  if (/\/boards\//.test(url)) {
    const board = await parseBoard(url);
    return { kind: "board", board };
  }
  // Best-effort autodetect by probing; try post -> section -> board
  try {
    const thread = await parseThread(url);
    return { kind: "thread", thread };
  } catch (_err) {
    void _err;
  }
  try {
    const section = await parseSection(url);
    return { kind: "section", section };
  } catch (_err) {
    void _err;
  }
  const board = await parseBoard(url);
  return { kind: "board", board };
}
