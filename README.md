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
import {
  fetchThread,
  fetchSection,
  fetchBoard,
  fetchStructure,
  Thread,
  Section,
  Board,
} from "glowfic-dl";

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

## CLI

Usage:

```
node dist/cli.js <urls...> [options]
```

Examples:

```
# Write a single thread to stdout
node dist/cli.js https://glowfic.com/posts/5506 --stdout

# Dry-run multiple URLs into an output directory
node dist/cli.js https://glowfic.com/posts/5506 https://glowfic.com/boards/215 --output-dir out --dry-run

# Save to a specific file (overwrite if it exists)
node dist/cli.js https://glowfic.com/posts/5506 -o out/thread.json --force

# Fetch concurrently with 8 workers
node dist/cli.js https://glowfic.com/board_sections/703 https://glowfic.com/boards/215 --output-dir out --concurrency 8
```

Options:

- `-o, --output <path>`: output file path (for a single URL). When passing multiple URLs, prefer `--output-dir`.
- `--output-dir <dir>`: directory to write outputs (default: 'out' when not using `-o` or `--stdout`).
- `-f, --format json`: output format (currently only JSON).
- `--markdown`: convert post content HTML to Markdown before saving (default: true).
- `--stdout`: write JSON to stdout instead of files (one JSON per URL; multiple URLs produce multiple lines).
- `--dry-run`: print what would be downloaded and where, without writing anything.
- `--force`: overwrite existing files if they already exist.
- `--concurrency <n>`: number of parallel downloads when passing multiple URLs (default: 4).

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
