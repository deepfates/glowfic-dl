#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { fetchStructure, fetchBoard, fetchSection, fetchThread } from "./index.js";
import { makeFilenameValidForEpub3 } from "./util.js";

type Format = "json";

const argv = await yargs(hideBin(process.argv))
  .scriptName("glowfic-dl-ts")
  .usage("$0 <url> [options]")
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
  .help()
  .parse();

async function writeJson(path: string, data: unknown) {
  const fs = await import("node:fs/promises");
  await fs.writeFile(path, JSON.stringify(data, null, 2), { encoding: "utf-8" });
}

async function main() {
  const url = argv._[0] as string;
  const format = argv.format as Format;
  if (format !== "json") throw new Error("Only JSON output is implemented.");

  if (/\/posts\//.test(url)) {
    const t = await fetchThread(url);
    const path = argv.output ?? makeFilenameValidForEpub3(`${t.title}.json`);
    await writeJson(path, t);
    console.log(`Saved JSON to ${path}`);
    return;
  }
  if (/\/board_sections\//.test(url)) {
    const s = await fetchSection(url);
    const path = argv.output ?? makeFilenameValidForEpub3(`${s.title ?? "section"}.json`);
    await writeJson(path, s);
    console.log(`Saved JSON to ${path}`);
    return;
  }
  if (/\/boards\//.test(url)) {
    const b = await fetchBoard(url);
    const path = argv.output ?? makeFilenameValidForEpub3(`${b.title}.json`);
    await writeJson(path, b);
    console.log(`Saved JSON to ${path}`);
    return;
  }
  // Fallback: detect automatically
  const s = await fetchStructure(url);
  if (s.kind === "thread") {
    const path = argv.output ?? makeFilenameValidForEpub3(`${s.thread.title}.json`);
    await writeJson(path, s.thread);
    console.log(`Saved JSON to ${path}`);
  } else if (s.kind === "section") {
    const path = argv.output ?? makeFilenameValidForEpub3(`${s.section.title ?? "section"}.json`);
    await writeJson(path, s.section);
    console.log(`Saved JSON to ${path}`);
  } else {
    const path = argv.output ?? makeFilenameValidForEpub3(`${s.board.title}.json`);
    await writeJson(path, s.board);
    console.log(`Saved JSON to ${path}`);
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
