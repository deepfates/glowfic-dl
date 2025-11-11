#!/usr/bin/env node
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import ora from "ora";
import yargs from "yargs";

import { fetchStructure, fetchBoard, fetchSection, fetchThread } from "./index.js";
import { threadToMarkdown, sectionToMarkdown, boardToMarkdown } from "./transform.js";
import { makeFilenameValidForEpub3 } from "./util.js";

type Format = "json";

async function writeJson(path: string, data: unknown, opts: { force: boolean }) {
  const fs = await import("node:fs/promises");
  const dir = dirname(path);
  if (dir) {
    await fs.mkdir(dir, { recursive: true });
  }
  if (!opts.force) {
    try {
      await fs.stat(path);
      throw new Error(`Refusing to overwrite existing file without --force: ${path}`);
    } catch (err: any) {
      if (err && (err as { code?: string }).code === "ENOENT") {
        // File does not exist -> ok to write
      } else {
        // Re-throw other errors, including our intentional overwrite error
        throw err;
      }
    }
  }
  await fs.writeFile(path, JSON.stringify(data, null, 2), { encoding: "utf-8" });
}

export async function runCli(args: readonly string[]) {
  const argv = await yargs(args)
    .scriptName("glowfic-dl")
    .usage("$0 <urls...> [options]")
    .positional("url", {
      describe: "Glowfic thread, section, or board URL",
      type: "string",
      demandOption: true,
    })
    .option("format", {
      alias: "f",
      describe: "output format",
      choices: ["json"] as const,
      default: "json",
    })
    .option("output", {
      alias: "o",
      describe: "output file path; default based on title",
      type: "string",
    })
    .option("output-dir", {
      describe: "directory to write outputs (default: 'out' when not using -o or --stdout)",
      type: "string",
    })
    .option("stdout", {
      describe: "write JSON to stdout instead of a file",
      type: "boolean",
      default: false,
    })
    .option("dry-run", {
      describe: "print what would be downloaded and where; no writes",
      type: "boolean",
      default: false,
    })
    .option("force", {
      describe: "overwrite existing files",
      type: "boolean",
      default: false,
    })
    .option("concurrency", {
      describe: "number of parallel downloads when passing multiple URLs",
      type: "number",
      default: 4,
    })
    .option("progress", {
      describe:
        "show a single spinner while processing (default on in TTY unless --stdout or --dry-run)",
      type: "boolean",
    })
    .option("markdown", {
      describe: "convert post content HTML to Markdown before saving (default: true)",
      type: "boolean",
      default: true,
    })
    .help()
    .parse();
  const urls = (argv._ as Array<string | number | symbol>).map(String).filter(Boolean);
  const format = argv.format as Format;
  if (format !== "json") throw new Error("Only JSON output is implemented.");
  if (urls.length === 0) {
    throw new Error("At least one URL is required. Usage: glowfic-dl <urls...> [options]");
  }

  const outDirOpt =
    (argv["output-dir"] as string | undefined) ??
    (!argv.stdout && (!argv.output || urls.length > 1) ? "out" : undefined);
  const toStdout = Boolean(argv.stdout);
  const dryRun = Boolean(argv["dry-run"]);
  const force = Boolean(argv.force);
  const concurrency = Math.max(1, Number(argv.concurrency ?? 4));
  const markdown = Boolean(argv.markdown);
  const progressFlag = argv.progress as boolean | undefined;
  const progressEnabled = progressFlag ?? (process.stdout.isTTY && !toStdout && !dryRun);
  const spinner = progressEnabled ? ora({ text: "Processing..." }).start() : null;

  function detectKind(url: string): "thread" | "section" | "board" | "unknown" {
    if (/\/posts\//.test(url)) return "thread";
    if (/\/board_sections\//.test(url)) return "section";
    if (/\/boards\//.test(url)) return "board";
    return "unknown";
  }

  function idFromUrl(url: string): string {
    try {
      const u = new URL(url);
      const parts = u.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] ?? "";
    } catch {
      return "";
    }
  }

  function defaultNameFromUrl(url: string): string {
    const kind = detectKind(url);
    const id = idFromUrl(url) || "unknown";
    if (kind === "thread") return `thread-${id}.json`;
    if (kind === "section") return `section-${id}.json`;
    if (kind === "board") return `board-${id}.json`;
    return `glowfic-${id}.json`;
  }

  const limit = (function pLimit(n: number) {
    let active = 0;
    const queue: Array<() => void> = [];
    const next = () => {
      active--;
      const fn = queue.shift();
      if (fn) fn();
    };
    return async function run<T>(fn: () => Promise<T>): Promise<T> {
      if (active >= n) {
        await new Promise<void>((resolve) => queue.push(resolve));
      }
      active++;
      try {
        return await fn();
      } finally {
        next();
      }
    };
  })(concurrency);

  async function processUrl(url: string): Promise<void> {
    if (dryRun) {
      if (toStdout) {
        console.log(`[dry-run] ${url} -> stdout`);
        return;
      }
      const base = defaultNameFromUrl(url);
      const outPath = outDirOpt
        ? join(outDirOpt, base)
        : urls.length === 1 && typeof argv.output === "string" && argv.output
          ? (argv.output as string)
          : makeFilenameValidForEpub3(base);
      console.log(`[dry-run] ${url} -> ${outPath}`);
      return;
    }

    const kind = detectKind(url);
    if (kind === "thread") {
      const t = await fetchThread(url);
      const data = markdown ? threadToMarkdown(t) : t;
      if (toStdout) {
        process.stdout.write(`${JSON.stringify(data)}\n`);
        return;
      }
      const base = makeFilenameValidForEpub3(`${t.title}.json`);
      const outPath = outDirOpt
        ? join(outDirOpt, base)
        : urls.length === 1 && typeof argv.output === "string" && argv.output
          ? (argv.output as string)
          : base;
      await writeJson(outPath, data, { force });
      console.log(`Saved JSON to ${outPath}`);
      return;
    }
    if (kind === "section") {
      const s = await fetchSection(url);
      const data = markdown ? sectionToMarkdown(s) : s;
      if (toStdout) {
        process.stdout.write(`${JSON.stringify(data)}\n`);
        return;
      }
      const base = makeFilenameValidForEpub3(`${s.title ?? "section"}.json`);
      const outPath = outDirOpt
        ? join(outDirOpt, base)
        : urls.length === 1 && typeof argv.output === "string" && argv.output
          ? (argv.output as string)
          : base;
      await writeJson(outPath, data, { force });
      console.log(`Saved JSON to ${outPath}`);
      return;
    }
    if (kind === "board") {
      const b = await fetchBoard(url);
      const data = markdown ? boardToMarkdown(b) : b;
      if (toStdout) {
        process.stdout.write(`${JSON.stringify(data)}\n`);
        return;
      }
      const base = makeFilenameValidForEpub3(`${b.title}.json`);
      const outPath = outDirOpt
        ? join(outDirOpt, base)
        : urls.length === 1 && typeof argv.output === "string" && argv.output
          ? (argv.output as string)
          : base;
      await writeJson(outPath, data, { force });
      console.log(`Saved JSON to ${outPath}`);
      return;
    }

    // Unknown: autodetect by probing
    const any = await fetchStructure(url);
    const data =
      any.kind === "thread" ? any.thread : any.kind === "section" ? any.section : any.board;
    if (toStdout) {
      process.stdout.write(`${JSON.stringify(data)}\n`);
      return;
    }
    const base = makeFilenameValidForEpub3(
      any.kind === "thread"
        ? `${any.thread.title}.json`
        : any.kind === "section"
          ? `${any.section.title ?? "section"}.json`
          : `${any.board.title}.json`,
    );
    const outPath = outDirOpt
      ? join(outDirOpt, base)
      : urls.length === 1 && typeof argv.output === "string" && argv.output
        ? (argv.output as string)
        : base;
    await writeJson(outPath, data, { force });
    console.log(`Saved JSON to ${outPath}`);
  }

  await Promise.all(urls.map((u) => limit(() => processUrl(u))));
  if (spinner) spinner.succeed("Done");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2)).catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}
