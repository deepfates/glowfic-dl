# Glowfic Downloader (TypeScript port)

Minimal TypeScript port that downloads Glowfic threads, sections, and boards and outputs JSON compatible with the Python version's JSON.

## Install

```
npm install
npm run build
```

Node 18+ recommended.

## Programmatic usage (library)

```ts
import { fetchThread, fetchSection, fetchBoard, fetchStructure, Thread, Section, Board } from "glowfic-dl-ts";

// Thread
const t: Thread = await fetchThread("https://glowfic.com/posts/5506");

// Section
const s: Section = await fetchSection("https://glowfic.com/board_sections/703");

// Board
const b: Board = await fetchBoard("https://glowfic.com/boards/215");

// Auto-detect (returns a discriminated union)
const any = await fetchStructure("https://glowfic.com/posts/5506");
if (any.kind === "thread") {
  console.log(any.thread.posts.length);
}
```

## Usage

```
node dist/cli.js <url> [-o output.json]
```

Examples:

```
node dist/cli.js https://glowfic.com/posts/5506
node dist/cli.js https://glowfic.com/board_sections/703
node dist/cli.js https://glowfic.com/boards/215
```

Options:

- `-o, --output <path>`: output file path (default: `<title>.json`, sanitized)
- `-f, --format json`: output format (JSON only for now)

Notes:

- Uses the classic view for consistent HTML parsing.
- Only public content is supported in this MVP. Authentication and EPUB output are planned next.

## Dev

```
npm run dev  # runs the CLI in dev mode
```

## Roadmap

- Authenticated requests (private posts)
- EPUB generation in TypeScript (feature parity with Python)
