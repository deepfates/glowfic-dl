import * as cheerio from "cheerio";
import TurndownService from "turndown";

import { GLOWFIC_ROOT, type Board, type Section, type Thread, type Post } from "./types.js";

export type MarkdownTransformOptions = {
  /**
   - Convert relative href/src attributes to absolute using this base URL.
   - Defaults to GLOWFIC_ROOT ("https://glowfic.com").
   */
  baseUrl?: string;
  /**
   - Whether to absolutize href/src attributes before converting to Markdown.
   - Defaults to true.
   */
  absoluteUrls?: boolean;
  /**
   - Configure Turndown heading style (default: "atx")
   */
  headingStyle?: "setext" | "atx";
  /**
   - Marker for bullet list items (default: "-")
   */
  bulletListMarker?: "-" | "*" | "+";
  /**
   - When true, preserves unknown inline HTML tags as-is inside Markdown by wrapping
     their content in raw HTML instead of stripping them. Default: false (Turndown default behavior).
   */
  keepUnknownInlineHtml?: boolean;
};

/**
 Create and configure a Turndown service suitable for Glowfic post content.
*/
export function createTurndown(options?: MarkdownTransformOptions): TurndownService {
  const {
    headingStyle = "atx",
    bulletListMarker = "-",
    keepUnknownInlineHtml = false,
  } = options ?? {};

  const td = new TurndownService({
    headingStyle,
    bulletListMarker,
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
    linkReferenceStyle: "full",
  });

  // Replace <br> with a plain newline (not two-space-soft-break)
  td.addRule("lineBreaks", {
    filter: ["br"],
    replacement: () => "\n",
  });

  // Render images as Markdown images; include title when available.
  td.addRule("images", {
    filter: "img",
    replacement: (content, node) => {
      const el = node as any;
      const src = (el.getAttribute("src") || "").trim();
      if (!src) return "";
      const alt = (el.getAttribute("alt") || "").replace(/\n/g, " ").trim();
      const title = (el.getAttribute("title") || "").replace(/\n/g, " ").trim();
      const altText = alt ? alt : "";
      const titlePart = title ? ` "${escapeQuotes(title)}"` : "";
      return `![${escapeBrackets(altText)}](${src}${titlePart})`;
    },
  });

  // Ensure <pre><code>...</code></pre> becomes fenced code blocks with language if available.
  td.addRule("fencedCodeBlocks", {
    filter: (node) =>
      node.nodeName === "PRE" && node.firstChild !== null && node.firstChild.nodeName === "CODE",
    replacement: (_content, node) => {
      const codeNode = node.firstChild as any;
      const className = (codeNode.getAttribute("class") || "").toLowerCase();
      const langMatch = className.match(/language-([a-z0-9#+-]+)/i);
      const lang = langMatch ? langMatch[1] : "";
      const codeText = (codeNode.textContent || "").replace(/\n$/, "");
      const fence = "```";
      return `\n${fence}${lang ? `${lang}` : ""}\n${codeText}\n${fence}\n`;
    },
  });

  // Optionally keep unknown inline HTML (span, i, etc.) instead of stripping entirely.
  if (keepUnknownInlineHtml) {
    td.addRule("keepUnknownInline", {
      filter: (node) => {
        // Keep some inline-ish elements raw if no explicit rule handles them.
        const inlineTags = new Set(["SPAN", "I", "B", "U", "SUP", "SUB", "SMALL", "MARK", "TIME"]);
        return inlineTags.has(node.nodeName);
      },
      replacement: (content, node) => {
        // no-op: removed unused Cheerio clone
        // Reconstruct minimal tag around content
        const tag = (node as any).tagName.toLowerCase();
        const attrs: string[] = [];
        const rawAttrs = (node as any).attributes ?? [];
        for (const attr of Array.from(rawAttrs as any)) {
          const name = (attr as any).name as string | undefined;
          const value = (attr as any).value as string | undefined;
          if (name && value != null) attrs.push(`${name}="${escapeHtmlAttr(value)}"`);
        }
        const open = attrs.length ? `<${tag} ${attrs.join(" ")}>` : `<${tag}>`;
        const close = `</${tag}>`;
        return `${open}${content}${close}`;
      },
    });
  }

  return td;
}

/**
 Convert a post's HTML (Glowfic "post-content") to Markdown.
 - Absolutizes <a href> and <img src> to the provided base (defaults to GLOWFIC_ROOT)
 - Strips the outer div.post-content wrapper if present
 - Uses Turndown for HTML -> Markdown
*/
export function htmlToMarkdown(html: string, options?: MarkdownTransformOptions): string {
  const baseUrl = options?.baseUrl ?? GLOWFIC_ROOT;
  const absolutize = options?.absoluteUrls ?? true;

  // Extract just the inner content if the outer wrapper is present
  let inner = extractInnerPostContent(html);
  if (absolutize) {
    inner = absolutizeUrls(inner, baseUrl);
  }

  const td = createTurndown(options);
  const md = td.turndown(inner);
  // Normalize triple-newlines -> double-newlines for neater formatting
  return collapseBlankLines(md);
}

/**
 Return a new Thread object whose posts' content have been converted from HTML to Markdown.
*/
export function threadToMarkdown(input: Thread, options?: MarkdownTransformOptions): Thread {
  return {
    ...input,
    posts: input.posts.map((p) => postToMarkdown(p, options)),
  };
}

/**
 Return a new Section object whose posts' content have been converted to Markdown.
*/
export function sectionToMarkdown(input: Section, options?: MarkdownTransformOptions): Section {
  return {
    ...input,
    threads: input.threads.map((t) => threadToMarkdown(t, options)),
  };
}

/**
 Return a new Board object whose posts' content have been converted to Markdown.
*/
export function boardToMarkdown(input: Board, options?: MarkdownTransformOptions): Board {
  const sections = input.sections.map((s) => sectionToMarkdown(s, options));
  // threads is a convenience flatten; recompute from transformed sections to stay in sync
  const threads = sections.flatMap((s) => s.threads);
  return {
    ...input,
    sections,
    threads,
  };
}

/**
 Return a shallow copy of Post with content converted to Markdown.
*/
export function postToMarkdown(p: Post, options?: MarkdownTransformOptions): Post {
  return {
    ...p,
    content: htmlToMarkdown(p.content, options),
  };
}

/* --------------------------------- internals -------------------------------- */

function extractInnerPostContent(html: string): string {
  try {
    const $ = cheerio.load(html);
    const $pc = $("div.post-content").first();
    if ($pc.length) {
      // Return the inner HTML of the post-content container
      return $pc.html() ?? "";
    }
    // If the caller already passed a fragment without wrapper, use as-is
    // But ensure we return just the HTML of body if a full doc was passed.
    const body = $("body");
    if (body.length) {
      return body.html() ?? html;
    }
    return html;
  } catch {
    return html;
  }
}

function absolutizeUrls(html: string, baseUrl: string): string {
  try {
    const $ = cheerio.load(html);

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const abs = new URL(href, baseUrl).toString();
        $(el).attr("href", abs);
      } catch {
        // ignore invalid URLs
      }
    });

    $("img[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (!src) return;
      try {
        const abs = new URL(src, baseUrl).toString();
        $(el).attr("src", abs);
      } catch {
        // ignore invalid URLs
      }
    });

    return $.root().html() ?? html;
  } catch {
    return html;
  }
}

function collapseBlankLines(s: string): string {
  // Convert CRLF -> LF first, then collapse 3+ blank lines to 2.
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}

function escapeBrackets(s: string): string {
  return s.replace(/]/g, "\\]");
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
