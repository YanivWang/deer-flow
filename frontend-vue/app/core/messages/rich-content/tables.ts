import type { RichInlinePart, RichTableColumnAlignment } from "./types";
import { isEscapedMarkdownPunctuation } from "./sanitizer";

export function isTableHeader(headerLine: string, dividerLine: string): boolean {
  const headers = splitTableRow(headerLine);
  const dividers = splitTableRow(dividerLine);
  return headers.length >= 2 && dividers.length === headers.length && dividers.every(isTableDividerCell);
}

export function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  const start = trimmed[0] === "|" && !isEscapedMarkdownPunctuation(trimmed, 0) ? 1 : 0;
  const end = trimmed.at(-1) === "|" && !isEscapedMarkdownPunctuation(trimmed, trimmed.length - 1) ? trimmed.length - 1 : trimmed.length;
  const cells: string[] = [];
  let cell = "";
  let codeDelimiter: number | null = null;
  let cursor = start;
  while (cursor < end) {
    const char = trimmed[cursor] ?? "";
    if (char === "`") {
      const runLength = consumeBacktickRun(trimmed, cursor);
      cell += trimmed.slice(cursor, cursor + runLength);
      codeDelimiter = codeDelimiter === null ? runLength : runLength === codeDelimiter ? null : codeDelimiter;
      cursor += runLength;
      continue;
    }
    if (char === "|" && codeDelimiter === null && !isEscapedMarkdownPunctuation(trimmed, cursor)) {
      cells.push(cell.trim()); cell = ""; cursor += 1; continue;
    }
    cell += char; cursor += 1;
  }
  cells.push(cell.trim());
  return cells;
}

function consumeBacktickRun(line: string, index: number): number {
  let length = 0;
  while (line[index + length] === "`") length += 1;
  return length;
}

function isTableDividerCell(cell: string): boolean { return /^:?-{3,}:?$/.test(cell); }

export function readTableDividerAlignment(cell: string): RichTableColumnAlignment {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  return left && right ? "center" : right ? "right" : left ? "left" : null;
}

export function normalizeTableRow(cells: string[], columnCount: number): string[] {
  return cells.length >= columnCount ? cells.slice(0, columnCount) : [...cells, ...Array.from({ length: columnCount - cells.length }, () => "")];
}

export function flattenTableParts(block: { headers: RichInlinePart[][]; rows: RichInlinePart[][][] }): RichInlinePart[] {
  return [...block.headers.flat(), ...block.rows.flat(2)];
}
