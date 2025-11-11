# Changelog

All notable changes to this project will be documented in this file.

The format loosely follows Keep a Changelog and Conventional Commits.
Version numbers follow SemVer.

## [0.2.1] - 2025-11-11

### Features

- CLI: Default to converting post content HTML to Markdown (`--markdown` now true by default; use `--no-markdown` to disable)
- CLI: Default output directory to `out/` when not using `-o` or `--stdout`

### Refactor

- Rename CLI script name to `glowfic-dl` in help/usage text
- Update User-Agent to `glowfic-dl/<version>` for HTTP requests

### Docs

- Update README to reference `glowfic-dl` package name and document new defaults

### Chore

- Add `out/` and scratch artifacts to `.gitignore`
- Remove accidentally committed output files
- Add `npm run clean` script to remove `dist`, `out`, `coverage`, and `*.tsbuildinfo`

### Notes

- Library API still returns HTML in `post.content` by default; CLI converts to Markdown by default. Use the transform helpers in code to get Markdown objects.

## [0.2.0] - 2025-11-11

### Features

- CLI enhancements:
  - Multi-URL support and parallel fetching (`--concurrency`)
  - Stdout output (`--stdout`)
  - Output directory for bulk operations (`--output-dir`)
  - Force overwrite (`--force`)
  - Dry run (`--dry-run`)
- Spinner: Optional single spinner with TTY detection (`--progress`)
- Markdown conversion option in CLI (`--markdown`) via new transform helpers:
  - `htmlToMarkdown`, `postToMarkdown`, `threadToMarkdown`, `sectionToMarkdown`, `boardToMarkdown`

### Refactor

- Export `runCli(args)` from CLI; only auto-run when invoked as main (improves testability)
- Primary bin alias `glowfic-dl` added (alongside `glowfic-dl-ts` for compatibility)

### Tests

- Add CLI E2E tests (stdout, file write, dry-run, concurrency, autodetect)
- Ensure progress auto-disables for `--stdout`/`--dry-run` and non-TTY

### Docs

- Add CLI usage examples and options matrix to README

### Notes

- Package is ESM-only and targets Node 18+

## [0.1.1] - 2025-11-11

### CI/Build

- Add GitHub Actions workflow: build, lint, prettier check, smoke CLI run
- Add ESLint (flat config), Prettier, commitlint, and Husky hooks

### Tests

- Add Vitest setup and unit tests:
  - Parser: `parseThread` fixture tests and edge cases
  - Utils: `makeFilenameValidForEpub3` cases and truncation
  - Section/Board parsing with inline fixtures and error-path propagation

### Fixes

- Parser: Improve character extraction fallback when `.post-info-text` lacks character/screenname
- Type fixes for Cheerio v1 types

## [0.1.0] - 2025-11-11

### Initial Release (TypeScript MVP)

- Programmatic API:
  - `fetchThread`, `fetchSection`, `fetchBoard`, `fetchStructure`
- HTML parsing for threads, sections, and boards (classic view)
- Basic CLI to fetch a single URL to JSON
- Build tooling: TypeScript config, project scaffolding, initial README

---

## Migration Notes

- 0.2.1
  - CLI now defaults to Markdown conversion; pass `--no-markdown` to keep HTML content.
  - CLI now defaults to writing files to `out/` unless `-o` or `--stdout` is used.

- 0.2.0
  - Prefer the `glowfic-dl` binary name going forward (the `glowfic-dl-ts` alias remains available).
  - If you script `npm run start`, remember to forward flags with `--`:
    - `npm run start -- https://glowfic.com/posts/5506 --force`

[0.2.1]: https://github.com/deepfates/glowfic-dl/releases/tag/v0.2.1
[0.2.0]: https://github.com/deepfates/glowfic-dl/releases/tag/v0.2.0
[0.1.1]: https://github.com/deepfates/glowfic-dl/releases/tag/v0.1.1
[0.1.0]: https://github.com/deepfates/glowfic-dl/releases/tag/v0.1.0
