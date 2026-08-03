import remend from "remend";

import {
  BLOCKQUOTE_PREFIX_RE,
  DEEP_BLOCKQUOTE_HINT_RE,
  DEEP_INDENT_HINT_RE,
  FENCE_MARKER_RE,
  INDENTED_CODE_RE,
  MAX_BLOCKQUOTE_DEPTH,
  MAX_LIST_INDENT,
} from "./constants";
import { normalizeStreamdownMathMarkdown } from "./math";
import { stripLeakedSystemTags } from "./sanitizer";

export function readNextFenceMarker(line: string, currentFenceMarker: string | null): string | null {
  const fenceMatch = FENCE_MARKER_RE.exec(line);
  if (!fenceMatch) return currentFenceMarker;
  const marker = fenceMatch[1] ?? "";
  if (currentFenceMarker === null) return marker;
  const sameFenceChar = marker.startsWith(currentFenceMarker.charAt(0));
  return sameFenceChar && marker.length >= currentFenceMarker.length ? null : currentFenceMarker;
}

export function capBlockquoteNesting(markdown: string): string {
  if (!DEEP_BLOCKQUOTE_HINT_RE.test(markdown)) return markdown;
  let fenceMarker: string | null = null;
  return markdown.split("\n").map((line) => {
    fenceMarker = readNextFenceMarker(line, fenceMarker);
    if (fenceMarker !== null || INDENTED_CODE_RE.test(line)) return line;
    const match = BLOCKQUOTE_PREFIX_RE.exec(line);
    if (!match) return line;
    const prefix = match[0] ?? "";
    let depth = 0;
    for (let index = 0; index < prefix.length; index += 1) {
      if (prefix[index] !== ">") continue;
      depth += 1;
      if (depth > MAX_BLOCKQUOTE_DEPTH) return line.slice(0, index) + line.slice(prefix.length);
    }
    return line;
  }).join("\n");
}

export function capListNesting(markdown: string): string {
  if (!DEEP_INDENT_HINT_RE.test(markdown)) return markdown;
  let fenceMarker: string | null = null;
  return markdown.split("\n").map((line) => {
    fenceMarker = readNextFenceMarker(line, fenceMarker);
    if (fenceMarker !== null) return line;
    const whitespace = /^[ \t]*/.exec(line)?.[0] ?? "";
    return whitespace.length <= MAX_LIST_INDENT ? line : " ".repeat(MAX_LIST_INDENT) + line.slice(whitespace.length);
  }).join("\n");
}

export function capMarkdownNesting(markdown: string): string {
  return capListNesting(capBlockquoteNesting(markdown));
}

export function getSafeRichMarkdown(markdown: string, streaming = false): string {
  const normalized = normalizeStreamdownMathMarkdown(capMarkdownNesting(stripLeakedSystemTags(markdown)));
  return streaming ? remendStreamingMarkdown(normalized) : normalized;
}

function remendStreamingMarkdown(markdown: string): string {
  const output: string[] = [];
  const paragraphLines: string[] = [];
  let fenceMarker: string | null = null;
  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    output.push(remend(paragraphLines.join("\n"), { inlineKatex: false, linkMode: "text-only" }));
    paragraphLines.length = 0;
  };
  for (const line of markdown.split("\n")) {
    const nextFenceMarker = readNextFenceMarker(line, fenceMarker);
    if (fenceMarker !== null || nextFenceMarker !== null) {
      flushParagraph(); output.push(line); fenceMarker = nextFenceMarker; continue;
    }
    if (line.trim() === "") { flushParagraph(); output.push(line); continue; }
    paragraphLines.push(line);
  }
  flushParagraph();
  return output.join("\n");
}

export { stripLeakedSystemTags } from "./sanitizer";
