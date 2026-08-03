import {
  resolveMarkdownArtifactUrl,
  resolveMessageMediaUrl,
} from "../../artifacts/utils";
import type { RichContentContext, RichInlinePart } from "./types";
import {
  AUTOLINK_LITERAL_RE,
  AUTOLINK_TRAILING_PUNCTUATION_RE,
  HARD_LINE_BREAK_RE,
} from "./constants";
import { normalizeLatexMathDelimiters, renderMathHtml } from "./math";
import {
  decodeCommonMarkVisibleText,
  findHtmlRanges,
  findRangeAt,
  isEscapedMarkdownPunctuation,
  isSafeHref,
  sanitizeInlineHtml,
  stripLeakedSystemTags,
} from "./sanitizer";

type InlineToken = { end: number; part: RichInlinePart };

export function parseRichInline(content: string, context: RichContentContext = {}): RichInlinePart[] {
  const parts: RichInlinePart[] = [];
  const normalizedContent = normalizeLatexMathDelimiters(stripLeakedSystemTags(content));
  const htmlRanges = findHtmlRanges(normalizedContent);
  const sanitizedWholeHtml = sanitizeInlineHtml(normalizedContent);
  if (sanitizedWholeHtml !== null && !hasInlineTokenOutsideHtml(normalizedContent, htmlRanges, context)) {
    return sanitizedWholeHtml ? [{ html: sanitizedWholeHtml, type: "html" }] : [];
  }
  let cursor = 0;
  while (cursor < normalizedContent.length) {
    const htmlRange = findRangeAt(cursor, htmlRanges);
    if (htmlRange) {
      pushHtmlAwareTextParts(parts, normalizedContent.slice(cursor, htmlRange.end), context);
      cursor = htmlRange.end;
      continue;
    }
    const token = readInlineToken(normalizedContent, cursor, context);
    if (token) { parts.push(token.part); cursor = token.end; continue; }
    const nextTokenIndex = findNextInlineTokenIndex(normalizedContent, cursor + 1, htmlRanges);
    pushHtmlAwareTextParts(parts, normalizedContent.slice(cursor, nextTokenIndex), context);
    cursor = nextTokenIndex;
  }
  return parts;
}

export function normalizeReferenceLabel(label: string): string {
  return decodeCommonMarkVisibleText(label).trim().replace(/\s+/g, " ").toLowerCase();
}

function readInlineToken(text: string, index: number, context: RichContentContext): InlineToken | null {
  if (isEscapedMarkdownPunctuation(text, index)) return null;
  return readMarkdownLinkToken(text, index, context)
    ?? readFootnoteReferenceToken(text, index, context)
    ?? readInlineCodeToken(text, index)
    ?? readWrappedInlineToken(text, index, "~~", "strikethrough", context)
    ?? readMathToken(text, index)
    ?? readWrappedInlineToken(text, index, "**", "strong", context)
    ?? readWrappedInlineToken(text, index, "*", "emphasis", context);
}

function readFootnoteReferenceToken(text: string, index: number, context: RichContentContext): InlineToken | null {
  if (!context.footnoteDefinitions || text[index] !== "[" || text[index + 1] !== "^") return null;
  const labelEnd = text.indexOf("]", index + 2);
  if (labelEnd === -1) return null;
  const label = normalizeReferenceLabel(text.slice(index + 2, labelEnd));
  if (!label || !context.footnoteDefinitions.has(label)) return null;
  const references = context.footnoteReferences;
  let referenceIndex = references?.indexOf(label) ?? -1;
  if (referenceIndex === -1) { references?.push(label); referenceIndex = references?.length ? references.length - 1 : 0; }
  return { end: labelEnd + 1, part: { index: referenceIndex + 1, label, type: "footnote-ref" } };
}

function readMarkdownLinkToken(text: string, index: number, context: RichContentContext): InlineToken | null {
  const isImage = text[index] === "!" && text[index + 1] === "[";
  const labelStart = isImage ? index + 2 : index + 1;
  if (!isImage && text[index] !== "[") return null;
  const labelEnd = text.indexOf("]", labelStart);
  if (labelEnd === -1) return null;
  const rawLabel = text.slice(labelStart, labelEnd);
  const label = decodeCommonMarkVisibleText(rawLabel);
  const directHref = readDirectMarkdownHref(text, labelEnd);
  const referenceHref = directHref ? null : readReferenceMarkdownHref(text, rawLabel, labelEnd, context.referenceDefinitions);
  const hrefToken = directHref ?? referenceHref;
  if (!hrefToken || !hrefToken.href) return null;
  const { end, href } = hrefToken;
  if (isImage) {
    return !isSafeHref(href)
      ? { end, part: { href, label, type: "unsafe-link" } }
      : { end, part: { alt: label, src: resolveImageSrc(href, context), type: "image" } };
  }
  if (!isSafeHref(href)) return { end, part: { href, label, type: "unsafe-link" } };
  const resolvedHref = resolveLinkHref(href, context);
  return { end, part: {
    citationLabel: label.startsWith("citation:") ? label.slice("citation:".length) : null,
    external: /^https?:\/\//.test(resolvedHref), href: resolvedHref, label, type: "link",
  } };
}

function readDirectMarkdownHref(text: string, labelEnd: number): { end: number; href: string } | null {
  if (text[labelEnd + 1] !== "(") return null;
  const hrefStart = labelEnd + 2;
  const hrefEnd = text.indexOf(")", hrefStart);
  if (hrefEnd === -1) return null;
  const href = text.slice(hrefStart, hrefEnd);
  return !href || /\s/.test(href) ? null : { end: hrefEnd + 1, href };
}

function readReferenceMarkdownHref(text: string, label: string, labelEnd: number, definitions: ReadonlyMap<string, string> | undefined): { end: number; href: string } | null {
  if (!definitions || definitions.size === 0) return null;
  if (text[labelEnd + 1] === "[") {
    const referenceEnd = text.indexOf("]", labelEnd + 2);
    if (referenceEnd === -1) return null;
    const referenceLabel = text.slice(labelEnd + 2, referenceEnd) || label;
    const href = definitions.get(normalizeReferenceLabel(referenceLabel));
    return href ? { end: referenceEnd + 1, href } : null;
  }
  const href = definitions.get(normalizeReferenceLabel(label));
  return href ? { end: labelEnd + 1, href } : null;
}

function readInlineCodeToken(text: string, index: number): InlineToken | null {
  if (text[index] !== "`") return null;
  const end = text.indexOf("`", index + 1);
  return end === -1 ? null : { end: end + 1, part: { text: text.slice(index + 1, end), type: "code" } };
}

function readWrappedInlineToken(text: string, index: number, delimiter: "**" | "*" | "~~", type: "strong" | "emphasis" | "strikethrough", context: RichContentContext): InlineToken | null {
  if (!text.startsWith(delimiter, index)) return null;
  if (delimiter === "~~" && isPartOfLongerTildeRun(text, index)) return null;
  if (delimiter === "*" && (text[index - 1] === "*" || text[index + 1] === "*")) return null;
  const contentStart = index + delimiter.length;
  const contentEnd = findClosingInlineDelimiter(text, delimiter, contentStart);
  if (contentEnd === -1) return null;
  const inner = text.slice(contentStart, contentEnd);
  if (inner.trim() !== inner || inner.length === 0) return null;
  return { end: contentEnd + delimiter.length, part: { parts: parseRichInline(inner, context), type } };
}

function readMathToken(text: string, index: number): InlineToken | null {
  if (text[index] !== "$" || /\d/.test(text[index + 1] ?? "")) return null;
  const end = text.indexOf("$", index + 1);
  if (end === -1) return null;
  const source = text.slice(index + 1, end).trim();
  return !source || source.includes("\n") ? null : { end: end + 1, part: { html: renderMathHtml(source, false), source, type: "math" } };
}

function findClosingInlineDelimiter(text: string, delimiter: "**" | "*" | "~~", start: number): number {
  let cursor = start;
  while (cursor < text.length) {
    const index = text.indexOf(delimiter, cursor);
    if (index === -1 || text.slice(cursor, index).includes("\n")) return -1;
    if (delimiter === "~~" && isPartOfLongerTildeRun(text, index)) { cursor = index + 1; continue; }
    if (delimiter !== "*" || text[index + 1] !== "*") return index;
    cursor = index + 1;
  }
  return -1;
}

function isPartOfLongerTildeRun(text: string, index: number): boolean { return text[index - 1] === "~" || text[index + 2] === "~"; }

function findNextInlineTokenIndex(text: string, start: number, htmlRanges: readonly { start: number; end: number }[]): number {
  for (let index = start; index < text.length; index += 1) {
    if (findRangeAt(index, htmlRanges)) return index;
    if (isEscapedMarkdownPunctuation(text, index)) continue;
    const char = text[index];
    if (char === "[" || char === "`" || char === "$" || char === "*" || (char === "!" && text[index + 1] === "[") || (char === "~" && text[index + 1] === "~")) return index;
  }
  return text.length;
}

function hasInlineTokenOutsideHtml(text: string, htmlRanges: readonly { start: number; end: number }[], context: RichContentContext): boolean {
  let cursor = 0;
  while (cursor < text.length) {
    const htmlRange = findRangeAt(cursor, htmlRanges);
    if (htmlRange) { cursor = htmlRange.end; continue; }
    if (readInlineToken(text, cursor, context)) return true;
    cursor += 1;
  }
  return false;
}

function pushTextPart(parts: RichInlinePart[], text: string): void {
  const visibleText = decodeCommonMarkVisibleText(text);
  if (!visibleText) return;
  const previousPart = parts.at(-1);
  if (previousPart?.type === "text" && !previousPart.reveal) { previousPart.text += visibleText; return; }
  parts.push({ text: visibleText, type: "text" });
}

function pushTextWithAutolinks(parts: RichInlinePart[], text: string, context: RichContentContext): void {
  AUTOLINK_LITERAL_RE.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = AUTOLINK_LITERAL_RE.exec(text)) !== null) {
    const rawUrl = match[0] ?? "";
    if (match.index > cursor) pushTextPart(parts, text.slice(cursor, match.index));
    const { href, label, trailingText } = normalizeAutolinkLiteral(rawUrl);
    if (href.length > 0 && isSafeHref(href)) {
      const resolvedHref = resolveLinkHref(href, context);
      parts.push({ citationLabel: null, external: /^https?:\/\//.test(resolvedHref), href: resolvedHref, label, type: "link" });
      pushTextPart(parts, trailingText);
    } else pushTextPart(parts, rawUrl);
    cursor = AUTOLINK_LITERAL_RE.lastIndex;
  }
  if (cursor < text.length) pushTextPart(parts, text.slice(cursor));
}

function pushTextWithHardBreaks(parts: RichInlinePart[], text: string, context: RichContentContext): void {
  HARD_LINE_BREAK_RE.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = HARD_LINE_BREAK_RE.exec(text)) !== null) {
    if (match.index > cursor) pushTextWithAutolinks(parts, text.slice(cursor, match.index), context);
    parts.push({ type: "line-break" });
    cursor = HARD_LINE_BREAK_RE.lastIndex;
  }
  if (cursor < text.length) pushTextWithAutolinks(parts, text.slice(cursor), context);
}

function normalizeAutolinkLiteral(rawUrl: string): { href: string; label: string; trailingText: string } {
  let label = rawUrl;
  let trailingText = "";
  while (label.length > 0 && AUTOLINK_TRAILING_PUNCTUATION_RE.test(label)) { trailingText = label.slice(-1) + trailingText; label = label.slice(0, -1); }
  while (hasUnmatchedTrailingBracket(label)) { trailingText = label.slice(-1) + trailingText; label = label.slice(0, -1); }
  if (/^www\./i.test(label)) return { href: `http://${label}`, label, trailingText };
  if (!/^[a-z][a-z\d+.-]*:/i.test(label) && label.includes("@")) return { href: `mailto:${label}`, label, trailingText };
  return { href: label, label, trailingText };
}

function hasUnmatchedTrailingBracket(text: string): boolean {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const opening = pairs[text.slice(-1)];
  if (!opening) return false;
  return countCharacters(text, text.slice(-1)) > countCharacters(text, opening);
}
function countCharacters(text: string, target: string): number { return [...text].filter((char) => char === target).length; }

function pushHtmlAwareTextParts(parts: RichInlinePart[], text: string, context: RichContentContext): void {
  const sanitizedHtml = sanitizeInlineHtml(text);
  if (sanitizedHtml === null) { pushTextWithHardBreaks(parts, text, context); return; }
  if (sanitizedHtml) parts.push({ html: sanitizedHtml, type: "html" });
}

function resolveLinkHref(href: string, context: RichContentContext): string {
  return context.threadId && href.startsWith("/mnt/") ? resolveMarkdownArtifactUrl(href, context.threadId) : href;
}
function resolveImageSrc(src: string, context: RichContentContext): string {
  return context.threadId ? resolveMessageMediaUrl({ artifactPaths: context.artifactPaths ?? [], src, threadId: context.threadId }) : src;
}
