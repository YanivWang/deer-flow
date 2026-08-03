import katex from "katex";

import { CODE_FENCE_RE, INDENTED_CODE_RE } from "./constants";

const KATEX_OPTIONS = { output: "html", strict: false, throwOnError: false } as const;

export function renderMathHtml(source: string, displayMode: boolean): string {
  return katex.renderToString(source, { ...KATEX_OPTIONS, displayMode });
}

type MathDelimiter = { close: "\\)" | "\\]"; replacement: "$" | "$$" };
type DelimiterState = { inlineCodeDelimiterLength: number | null; openBlock: MathDelimiter | null };

export function normalizeLatexMathDelimiters(markdown: string): string {
  if (!/[\\][([\])]/.test(markdown)) return markdown;
  let insideFence = false;
  let state: DelimiterState = { inlineCodeDelimiterLength: null, openBlock: null };
  return markdown.split("\n").map((line) => {
    if (CODE_FENCE_RE.test(line) && !state.openBlock) { insideFence = !insideFence; return line; }
    if (insideFence || (INDENTED_CODE_RE.test(line) && !state.openBlock)) return line;
    const converted = convertLatexDelimitersInLine(line, state);
    state = converted.state;
    return converted.line;
  }).join("\n");
}

function convertLatexDelimitersInLine(line: string, state: DelimiterState): { line: string; state: DelimiterState } {
  let result = "";
  let index = 0;
  let inlineCodeDelimiterLength = state.inlineCodeDelimiterLength;
  let openBlock = state.openBlock;
  while (index < line.length) {
    if (line[index] === "`") {
      const runLength = consumeBacktickRun(line, index);
      result += line.slice(index, index + runLength);
      if (!openBlock) inlineCodeDelimiterLength = inlineCodeDelimiterLength === null ? runLength : runLength === inlineCodeDelimiterLength ? null : inlineCodeDelimiterLength;
      index += runLength;
      continue;
    }
    const two = line.slice(index, index + 2);
    const inInlineCode = inlineCodeDelimiterLength !== null;
    if (two === "\\\\" && !inInlineCode) { result += two; index += 2; continue; }
    if (!inInlineCode && openBlock?.close === two) { result += openBlock.replacement; openBlock = null; index += 2; continue; }
    if (!inInlineCode && !openBlock && (two === "\\(" || two === "\\[")) {
      const display = two === "\\[";
      openBlock = { close: display ? "\\]" : "\\)", replacement: display ? "$$" : "$" };
      result += openBlock.replacement;
      index += 2;
      continue;
    }
    result += line[index];
    index += 1;
  }
  return { line: result, state: { inlineCodeDelimiterLength, openBlock } };
}

function consumeBacktickRun(line: string, index: number): number {
  let length = 0;
  while (line[index + length] === "`") length += 1;
  return length;
}

function hasUnescapedTexComment(line: string): boolean {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== "%") continue;
    let backslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) backslashes += 1;
    if (backslashes % 2 === 0) return true;
  }
  return false;
}

export function compactDisplayMathBlocks(markdown: string): string {
  if (!markdown.includes("$$")) return markdown;
  const output: string[] = [];
  let insideFence = false;
  let mathLines: string[] | null = null;
  for (const line of markdown.split("\n")) {
    if (CODE_FENCE_RE.test(line) && mathLines === null) { insideFence = !insideFence; output.push(line); continue; }
    if (insideFence || (INDENTED_CODE_RE.test(line) && mathLines === null)) { output.push(line); continue; }
    if (line.trim() === "$$") {
      if (mathLines === null) mathLines = [];
      else { output.push("$$", ...(mathLines.some(hasUnescapedTexComment) ? mathLines : [mathLines.map((item) => item.trim()).join(" ")]), "$$"); mathLines = null; }
      continue;
    }
    if (mathLines !== null) mathLines.push(line); else output.push(line);
  }
  if (mathLines !== null) output.push("$$", ...mathLines);
  return output.join("\n");
}

export function normalizeStreamdownMathMarkdown(markdown: string): string {
  return compactDisplayMathBlocks(normalizeLatexMathDelimiters(markdown));
}
