import type { RichContentBlock, RichContentContext, RichContentParseOptions } from "./types";
import {
  FOOTNOTE_CONTINUATION_RE,
  FOOTNOTE_DEFINITION_RE,
  INDENTED_CODE_RE,
  ORDERED_LIST_ITEM_RE,
  REFERENCE_DEFINITION_RE,
  SINGLE_LINE_DISPLAY_MATH_RE,
  TASK_LIST_ITEM_RE,
  THEMATIC_BREAK_RE,
  UNORDERED_LIST_ITEM_RE,
} from "./constants";
import { renderMathHtml } from "./math";
import { normalizeMermaidCode } from "./mermaid";
import { getSafeRichMarkdown, readNextFenceMarker } from "./markdown-safety";
import { isTableHeader, normalizeTableRow, readTableDividerAlignment, splitTableRow } from "./tables";
import { normalizeReferenceLabel, parseRichInline } from "./inline-parser";

type BlockOf<TType extends RichContentBlock["type"]> = Extract<RichContentBlock, { type: TType }>;

export function parseRichContent(content: string, context: RichContentContext = {}, options: RichContentParseOptions = {}): RichContentBlock[] {
  const blocks: RichContentBlock[] = [];
  const referenceContent = extractReferenceDefinitions(getSafeRichMarkdown(content, options.streaming === true));
  const lines = referenceContent.lines;
  const footnoteReferences: string[] = [];
  const richContext: RichContentContext = { ...context, footnoteDefinitions: referenceContent.footnotes, footnoteReferences, referenceDefinitions: referenceContent.definitions };
  let paragraphLines: string[] = [];
  let listItems: { checked: boolean | null; content: string }[] = [];
  let orderedListItems: string[] = [];
  let codeFence: { fence: string; language: string | null; lines: string[] } | null = null;
  let mathBlock: string[] | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ parts: parseRichInline(paragraphLines.join("\n"), richContext), type: "paragraph" });
    paragraphLines = [];
  };
  const flushList = () => {
    if (listItems.length === 0) return;
    const checkedItems = listItems.map((item) => item.checked);
    const hiddenItems = buildStreamingHiddenItems(listItems.map((item) => item.content), options);
    blocks.push({ type: "list", ...(checkedItems.some((item) => item !== null) ? { checkedItems } : {}), ...(hiddenItems.some(Boolean) ? { hiddenItems } : {}), items: listItems.map((item) => parseRichInline(item.content, richContext)) });
    listItems = [];
  };
  const flushOrderedList = () => {
    if (orderedListItems.length === 0) return;
    const hiddenItems = buildStreamingHiddenItems(orderedListItems, options);
    blocks.push({ type: "ordered-list", ...(hiddenItems.some(Boolean) ? { hiddenItems } : {}), items: orderedListItems.map((item) => parseRichInline(item, richContext)) });
    orderedListItems = [];
  };
  const flushLooseBlocks = () => { flushParagraph(); flushList(); flushOrderedList(); };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const fence = readFence(line);
    if (mathBlock) {
      if (line.trim() === "$$") { blocks.push({ html: renderMathHtml(mathBlock.join("\n"), true), source: mathBlock.join("\n"), type: "math" }); mathBlock = null; }
      else mathBlock.push(line);
      continue;
    }
    if (fence) {
      if (codeFence && isClosingFence(line, codeFence.fence)) { blocks.push(codeFenceBlock(codeFence.language, codeFence.lines.join("\n"))); codeFence = null; }
      else if (!codeFence) { flushLooseBlocks(); codeFence = { fence: fence.fence, language: fence.language, lines: [] }; }
      else codeFence.lines.push(line);
      continue;
    }
    if (codeFence) { codeFence.lines.push(line); continue; }
    const singleLineDisplayMath = readSingleLineDisplayMath(line);
    if (singleLineDisplayMath !== null) { flushLooseBlocks(); blocks.push({ html: renderMathHtml(singleLineDisplayMath, true), source: singleLineDisplayMath, type: "math" }); continue; }
    if (line.trim() === "$$") { flushLooseBlocks(); mathBlock = []; continue; }
    if (THEMATIC_BREAK_RE.test(line)) { flushLooseBlocks(); blocks.push({ type: "thematic-break" }); continue; }
    const nextLine = lines[lineIndex + 1] ?? "";
    if (isTableHeader(line, nextLine)) {
      flushLooseBlocks();
      const tableRows: string[][] = [];
      const columnCount = splitTableRow(line).length;
      const alignments = splitTableRow(nextLine).map(readTableDividerAlignment);
      lineIndex += 2;
      while (lineIndex < lines.length) {
        const rowLine = lines[lineIndex] ?? "";
        if (rowLine.trim() === "" || !rowLine.includes("|")) { lineIndex -= 1; break; }
        tableRows.push(normalizeTableRow(splitTableRow(rowLine), columnCount));
        lineIndex += 1;
      }
      blocks.push({ ...(alignments.some((alignment) => alignment !== null) ? { alignments } : {}), headers: splitTableRow(line).map((cell) => parseRichInline(cell, richContext)), rows: tableRows.map((row) => row.map((cell) => parseRichInline(cell, richContext))), type: "table" });
      continue;
    }
    const heading = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/.exec(line);
    if (heading) { flushLooseBlocks(); blocks.push({ level: heading[1]!.length as 1 | 2 | 3 | 4 | 5 | 6, parts: parseRichInline(normalizeAtxHeadingText(heading[2] ?? ""), richContext), type: "heading" }); continue; }
    const blockquote = /^>\s?(.+)$/.exec(line);
    if (blockquote) { flushLooseBlocks(); blocks.push({ parts: parseRichInline(blockquote[1] ?? "", richContext), type: "blockquote" }); continue; }
    const listItem = UNORDERED_LIST_ITEM_RE.exec(line);
    if (listItem) { flushParagraph(); flushOrderedList(); listItems.push(parseListItem(listItem[1] ?? "")); continue; }
    const orderedListItem = ORDERED_LIST_ITEM_RE.exec(line);
    if (orderedListItem) { flushParagraph(); flushList(); orderedListItems.push(orderedListItem[1] ?? ""); continue; }
    if (line.trim() === "") {
      const following = lines[lineIndex + 1] ?? "";
      if ((listItems.length > 0 || orderedListItems.length > 0) && isListMarkerLine(following)) continue;
      flushLooseBlocks(); continue;
    }
    flushList(); flushOrderedList(); paragraphLines.push(line);
  }
  if (codeFence) blocks.push(codeFenceBlock(codeFence.language, codeFence.lines.join("\n")));
  if (mathBlock) blocks.push({ html: renderMathHtml(mathBlock.join("\n"), true), source: mathBlock.join("\n"), type: "math" });
  flushLooseBlocks();
  const footnotes = buildFootnoteBlock(referenceContent, footnoteReferences, context);
  if (footnotes) blocks.push(footnotes);
  return blocks;
}

function extractReferenceDefinitions(markdown: string): { definitions: ReadonlyMap<string, string>; footnotes: ReadonlyMap<string, string>; lines: string[] } {
  const definitions = new Map<string, string>();
  const footnotes = new Map<string, string>();
  const lines: string[] = [];
  let fenceMarker: string | null = null;
  let currentFootnoteLabel: string | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    fenceMarker = readNextFenceMarker(line, fenceMarker);
    if (fenceMarker !== null) { lines.push(line); currentFootnoteLabel = null; continue; }
    if (currentFootnoteLabel) {
      const continuation = FOOTNOTE_CONTINUATION_RE.exec(line);
      if (continuation) { const previous = footnotes.get(currentFootnoteLabel) ?? ""; const next = continuation[1] ?? ""; footnotes.set(currentFootnoteLabel, previous ? `${previous}\n${next}` : next); lines.push(""); continue; }
      currentFootnoteLabel = null;
    }
    if (INDENTED_CODE_RE.test(line)) { lines.push(line); continue; }
    const footnote = FOOTNOTE_DEFINITION_RE.exec(line);
    if (footnote) { const label = normalizeReferenceLabel(footnote[1] ?? ""); if (label && !footnotes.has(label)) { footnotes.set(label, footnote[2] ?? ""); currentFootnoteLabel = label; } lines.push(""); continue; }
    const definition = REFERENCE_DEFINITION_RE.exec(line);
    if (!definition) { lines.push(line); continue; }
    const label = normalizeReferenceLabel(definition[1] ?? "");
    const href = normalizeReferenceHref(definition[2] ?? "");
    if (label && href && !definitions.has(label)) definitions.set(label, href);
    lines.push("");
  }
  return { definitions, footnotes, lines };
}

function buildFootnoteBlock(referenceContent: { definitions: ReadonlyMap<string, string>; footnotes: ReadonlyMap<string, string> }, references: readonly string[], context: RichContentContext): BlockOf<"footnotes"> | null {
  if (referenceContent.footnotes.size === 0 || references.length === 0) return null;
  const seen = new Set<string>();
  const items: BlockOf<"footnotes">["items"] = [];
  for (const label of references) {
    if (seen.has(label)) continue;
    const content = referenceContent.footnotes.get(label);
    if (content === undefined) continue;
    seen.add(label);
    items.push({ label, parts: parseRichInline(content, { ...context, footnoteDefinitions: referenceContent.footnotes, referenceDefinitions: referenceContent.definitions }) });
  }
  return items.length > 0 ? { items, type: "footnotes" } : null;
}

function normalizeReferenceHref(href: string): string { return href.startsWith("<") && href.endsWith(">") ? href.slice(1, -1) : href; }
function normalizeAtxHeadingText(text: string): string { return text.replace(/[ \t]+#+[ \t]*$/, "").trim(); }
function buildStreamingHiddenItems(items: readonly string[], options: RichContentParseOptions): boolean[] { return items.map((item, index) => options.streaming === true && item.trim() === "" && !items.slice(index + 1).some((laterItem) => laterItem.trim() !== "")); }
function isListMarkerLine(line: string): boolean { return UNORDERED_LIST_ITEM_RE.test(line) || ORDERED_LIST_ITEM_RE.test(line); }
function parseListItem(content: string): { checked: boolean | null; content: string } { const match = TASK_LIST_ITEM_RE.exec(content); return match ? { checked: (match[1] ?? "").toLowerCase() === "x", content: match[2] ?? "" } : { checked: null, content }; }
function readSingleLineDisplayMath(line: string): string | null { const source = SINGLE_LINE_DISPLAY_MATH_RE.exec(line)?.[1]?.trim(); return source || null; }

function codeFenceBlock(language: string | null, code: string): RichContentBlock {
  const normalizedLanguage = normalizeCodeLanguage(language);
  return normalizedLanguage === "mermaid" ? { code: normalizeMermaidCode(code), type: "mermaid" } : { code, language: normalizedLanguage, type: "code" };
}
function normalizeCodeLanguage(language: string | null): string | null { if (!language) return null; const normalized = language.trim().toLowerCase(); return /^[a-z][a-z0-9#+.-]{0,31}$/.test(normalized) ? normalized : null; }
function readFence(line: string): { fence: string; language: string | null } | null { const match = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)?.*$/.exec(line); return match ? { fence: match[1] ?? "```", language: match[2] || null } : null; }
function isClosingFence(line: string, fence: string): boolean { const trimmedLine = line.trimEnd(); const indentationLength = trimmedLine.length - trimmedLine.trimStart().length; const marker = trimmedLine.slice(indentationLength); const fenceChar = fence.charAt(0); return indentationLength <= 3 && marker.length >= fence.length && [...marker].every((char) => char === fenceChar); }

export { getSafeRichMarkdown } from "./markdown-safety";
