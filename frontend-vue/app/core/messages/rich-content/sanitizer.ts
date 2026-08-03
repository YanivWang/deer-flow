import { decodeNamedCharacterReference } from "decode-named-character-reference";

import {
  ENTITY_RE,
  ESCAPABLE_MARKDOWN_PUNCTUATION_RE,
  HTML_ATTR_RE,
  HTML_TAG_RE,
  INTERNAL_MARKER_RE,
  NAMED_CHARACTER_REFERENCES,
  SAFE_HREF_PROTOCOLS,
  SAFE_INLINE_HTML_TAGS,
  VOID_HTML_TAGS,
} from "./constants";

export type TextRange = { end: number; start: number };

export function isSafeHref(href: string | undefined): boolean {
  if (typeof href !== "string" || href.length === 0) return false;
  if (href.startsWith("#")) return true;
  if (/^(\/\/|\\\\)/.test(href)) return false;
  try {
    const parsed = new URL(href, "https://dummy.example/");
    return SAFE_HREF_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function decodeCommonMarkVisibleText(text: string): string {
  let result = "";
  let cursor = 0;
  while (cursor < text.length) {
    const current = text[cursor] ?? "";
    const next = text[cursor + 1] ?? "";
    if (current === "\\" && ESCAPABLE_MARKDOWN_PUNCTUATION_RE.test(next)) {
      result += next;
      cursor += 2;
      continue;
    }
    if (current === "&") {
      const entity = ENTITY_RE.exec(text.slice(cursor));
      if (entity) {
        result += decodeCharacterReference(entity);
        cursor += entity[0].length;
        continue;
      }
    }
    result += current;
    cursor += 1;
  }
  return result;
}

function decodeCharacterReference(entity: RegExpExecArray): string {
  const decimal = entity[1];
  const hexadecimal = entity[2];
  const named = entity[3];
  if (decimal || hexadecimal) {
    const value = Number.parseInt(decimal ?? hexadecimal ?? "", decimal ? 10 : 16);
    return isValidCharacterReferenceCode(value) ? String.fromCodePoint(value) : "\uFFFD";
  }
  return decodeNamedCharacterReference(named ?? "") || NAMED_CHARACTER_REFERENCES.get(named ?? "") || entity[0];
}

function isValidCharacterReferenceCode(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff);
}

export function isEscapedMarkdownPunctuation(text: string, index: number): boolean {
  const char = text[index] ?? "";
  if (!ESCAPABLE_MARKDOWN_PUNCTUATION_RE.test(char)) return false;
  let backslashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) backslashCount += 1;
  return backslashCount % 2 === 1;
}

export function stripLeakedSystemTags(markdown: string): string {
  let fenceMarker: string | null = null;
  return markdown.split("\n").map((line) => {
    fenceMarker = readNextFenceMarker(line, fenceMarker);
    if (fenceMarker !== null || /^(?: {4}|\t)/.test(line)) return line;
    return line.replace(INTERNAL_MARKER_RE, "");
  }).join("\n");
}

function readNextFenceMarker(line: string, currentFenceMarker: string | null): string | null {
  const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
  if (!match) return currentFenceMarker;
  const marker = match[1] ?? "";
  if (currentFenceMarker === null) return marker;
  return marker.startsWith(currentFenceMarker.charAt(0)) && marker.length >= currentFenceMarker.length
    ? null
    : currentFenceMarker;
}

export function findHtmlRanges(text: string): TextRange[] {
  const ranges: TextRange[] = [];
  const openTags: { name: string; start: number }[] = [];
  HTML_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HTML_TAG_RE.exec(text)) !== null) {
    const rawTag = match[0] ?? "";
    const tagName = (match[1] ?? "").toLowerCase();
    const start = match.index;
    const end = HTML_TAG_RE.lastIndex;
    const isClosing = /^<\//.test(rawTag);
    const isSelfClosing = /\/>$/.test(rawTag) || VOID_HTML_TAGS.has(tagName);
    if (isClosing) {
      const openIndex = openTags.findLastIndex((tag) => tag.name === tagName);
      if (openIndex === -1) { ranges.push({ start, end }); continue; }
      const [openTag] = openTags.splice(openIndex, 1);
      if (openTag) ranges.push({ start: openTag.start, end });
      continue;
    }
    if (isSelfClosing) { ranges.push({ start, end }); continue; }
    openTags.push({ name: tagName, start });
  }
  ranges.push(...openTags.map((tag) => ({ start: tag.start, end: tag.start + 1 })));
  return ranges;
}

export function findRangeAt(index: number, ranges: readonly TextRange[]): TextRange | null {
  return ranges.find((range) => index >= range.start && index < range.end) ?? null;
}

export function sanitizeInlineHtml(text: string): string | null {
  HTML_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let cursor = 0;
  let sawHtmlTag = false;
  let sawAllowedTag = false;
  let result = "";
  while ((match = HTML_TAG_RE.exec(text)) !== null) {
    sawHtmlTag = true;
    result += escapeHtml(text.slice(cursor, match.index));
    const rawTag = match[0] ?? "";
    const tagName = (match[1] ?? "").toLowerCase();
    if (SAFE_INLINE_HTML_TAGS.has(tagName)) {
      sawAllowedTag = true;
      result += sanitizeHtmlTag(rawTag, tagName);
    }
    cursor = HTML_TAG_RE.lastIndex;
  }
  if (!sawHtmlTag) return null;
  result += escapeHtml(text.slice(cursor));
  return sawAllowedTag ? result : stripHtmlTags(text);
}

function sanitizeHtmlTag(rawTag: string, tagName: string): string {
  if (/^<\//.test(rawTag)) return `</${tagName}>`;
  if (VOID_HTML_TAGS.has(tagName)) return `<${tagName}>`;
  if (tagName !== "a") return `<${tagName}>`;
  const href = readHtmlAttribute(rawTag, "href");
  if (href === undefined || !isSafeHref(href)) return "<a>";
  const external = /^https?:\/\//.test(href);
  return `<a href="${escapeHtmlAttribute(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>`;
}

function readHtmlAttribute(rawTag: string, name: string): string | undefined {
  HTML_ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HTML_ATTR_RE.exec(rawTag)) !== null) {
    if ((match[1] ?? "").toLowerCase() === name) return match[3] ?? match[4] ?? match[5] ?? "";
  }
  return undefined;
}

function stripHtmlTags(text: string): string { return text.replace(HTML_TAG_RE, ""); }
function escapeHtml(text: string): string { return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
function escapeHtmlAttribute(text: string): string { return escapeHtml(text).replaceAll('"', "&quot;"); }
