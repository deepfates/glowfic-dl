import * as cheerio from "cheerio";

import { getText } from "./fetch.js";
import { GLOWFIC_ROOT } from "./types.js";
import type { Post, Thread, Section, Board } from "./types.js";

function abs(url: string): string {
  try {
    return new URL(url, GLOWFIC_ROOT).toString();
  } catch {
    return url;
  }
}

function textOrNull(s: string | undefined | null): string | null {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}

function extractPostId($post: cheerio.Cheerio<any>): string {
  const idAttr = $post.attr("id");
  if (idAttr) return idAttr;
  const $permImg = $post.find("img[title='Permalink'][alt='Permalink']").first();
  const href = $permImg.parent().attr("href") || "";
  try {
    const u = new URL(href, GLOWFIC_ROOT);
    if (u.hash) return u.hash.replace(/^#/, "");
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
      if (parts[0] === "posts") return `post-${parts[1]}`;
      if (parts[0] === "replies") return `reply-${parts[1]}`;
    }
  } catch (_err) {
    void _err;
  }
  return "";
}

function extractTimestamp($post: cheerio.Cheerio<any>): string | null {
  const $footer = $post.find(".post-footer").first();
  let ts: string | null = null;
  const $time = ($footer.length ? $footer : $post).find("time").first();
  if ($time.attr("datetime")) ts = $time.attr("datetime")!;
  if (!ts && $time.attr("title")) ts = $time.attr("title")!;
  if (!ts) {
    const $abbr = ($footer.length ? $footer : $post).find("abbr[title]").first();
    if ($abbr.length) ts = $abbr.attr("title") || null;
  }
  if (!ts) {
    const t = $post.find(".post-time, .timestamp, .post-footer .post-posted").first().text().trim();
    if (t) ts = t;
  }
  return ts ? ts.trim() : null;
}

function extractCharacter($post: cheerio.Cheerio<any>): {
  display: string | null;
  handle: string | null;
} {
  const info = $post.find(".post-info-text").first();
  if (info.length) {
    const disp = textOrNull(info.find(".post-character").first().text());
    const handle = textOrNull(info.find(".post-screenname").first().text());
    return { display: disp, handle };
  }
  const header = $post.find(".post-header").first();
  if (header.length) {
    const disp =
      textOrNull(
        header
          .find(
            ".character-name, .post-character, .post-screenname, .post-character-name, .post-author-screenname",
          )
          .first()
          .text(),
      ) || null;
    const handle = textOrNull(header.find(".post-screenname").first().text());
    return { display: disp, handle };
  }
  return { display: null, handle: null };
}

function extractIcon($post: cheerio.Cheerio<any>): string | null {
  const a = $post.find("img.icon").first();
  if (a.attr("src")) return a.attr("src")!;
  const b = $post.find(".icon img").first();
  if (b.attr("src")) return b.attr("src")!;
  return null;
}

function extractAuthor($post: cheerio.Cheerio<any>): string | null {
  const info = $post.find(".post-info-text .post-author").first();
  if (info.length) return textOrNull(info.text());
  return textOrNull($post.find(".post-author").first().text());
}

function extractContentHtml($post: cheerio.Cheerio<any>): string {
  const body = $post.find("div.post-content").first();
  return body.length ? body.toString() : "";
}

export async function parseThread(threadUrl: string): Promise<Thread> {
  const html = await getText(threadUrl, { view: "flat", style: "classic" });
  const $ = cheerio.load(html);
  const title =
    $("th.table-title, #post-title").first().text().trim() || $("title").first().text().trim();
  const description = textOrNull($("td.written-content").first().text());
  const $posts = $("div.post-container");
  const posts: Post[] = [];
  const authorSet = new Set<string>();

  $posts.each((_, el) => {
    const $post = $(el);
    const author = extractAuthor($post);
    if (author) authorSet.add(author);
    const { display, handle } = extractCharacter($post);
    const icon = extractIcon($post);
    const timestamp = extractTimestamp($post);
    const content = extractContentHtml($post);
    const post_id = extractPostId($post);
    posts.push({
      post_id,
      author: author ?? null,
      character_display_name: display,
      character_handle: handle,
      icon_url: icon ? abs(icon) : null,
      timestamp,
      content,
    });
  });

  const idGuess = (() => {
    try {
      const u = new URL(threadUrl);
      const parts = u.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      return last ?? "";
    } catch {
      return "";
    }
  })();

  return {
    id: idGuess,
    title,
    url: threadUrl,
    description: description ?? null,
    posts,
    authors: Array.from(authorSet),
  };
}

export async function parseSection(sectionUrl: string): Promise<Section> {
  const html = await getText(sectionUrl);
  const $ = cheerio.load(html);
  const title = $("th.table-title").first().text().trim();
  const description = textOrNull($("td.written-content").first().text());
  const rows = $("td.post-subject a");
  const threads: Thread[] = [];
  for (let i = 0; i < rows.length; i++) {
    const a = rows.eq(i);
    const href = a.attr("href");
    if (!href) continue;
    const url = abs(href);
    const t = await parseThread(url);
    threads.push(t);
  }
  const id = (() => {
    try {
      const u = new URL(sectionUrl);
      const parts = u.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] ?? "";
    } catch {
      return "";
    }
  })();
  return {
    id,
    title: title || null,
    description: description ?? null,
    threads,
  };
}

export async function parseBoard(boardUrl: string): Promise<Board> {
  const html = await getText(boardUrl);
  const $ = cheerio.load(html);
  const title = $("th.table-title").first().text().trim() || $("title").first().text().trim();
  const rows = $("#content tr");
  type TmpSec = {
    title: string | null;
    description: string | null;
    threadLinks: string[];
  };
  const sectionsTmp: TmpSec[] = [];
  let cur: TmpSec = { title: null, description: null, threadLinks: [] };
  rows.each((_, el) => {
    const $el = $(el);
    const header = $el.find("th.continuity-header").first();
    const desc = $el.find("td.written-content").first();
    const thread = $el.find("td.post-subject a").first();
    const spacer = $el.find("td.continuity-spacer").first();
    if (header.length) {
      cur.title = header.text().trim();
    } else if (desc.length) {
      cur.description = desc.text().trim();
    } else if (thread.length) {
      const href = thread.attr("href");
      if (href) cur.threadLinks.push(abs(href));
    } else if (spacer.length) {
      sectionsTmp.push(cur);
      cur = { title: null, description: null, threadLinks: [] };
    }
  });
  if (cur.threadLinks.length) sectionsTmp.push(cur);

  const sections: Section[] = [];
  for (let si = 0; si < sectionsTmp.length; si++) {
    const s = sectionsTmp[si];
    const threads: Thread[] = [];
    for (const link of s.threadLinks) {
      const t = await parseThread(link);
      threads.push(t);
    }
    sections.push({
      id: String(si),
      title: s.title,
      description: s.description ?? null,
      threads,
    });
  }
  const id = (() => {
    try {
      const u = new URL(boardUrl);
      const parts = u.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] ?? "";
    } catch {
      return "";
    }
  })();
  return {
    id,
    title,
    description: null,
    sections,
    threads: sections.flatMap((s) => s.threads),
  };
}
