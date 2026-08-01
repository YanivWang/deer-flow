import katex from "katex";

import {
  resolveMarkdownArtifactUrl,
  resolveMessageMediaUrl,
} from "../artifacts/utils";

export type RichContentContext = {
  artifactPaths?: readonly string[];
  footnoteDefinitions?: ReadonlyMap<string, string>;
  footnoteReferences?: string[];
  referenceDefinitions?: ReadonlyMap<string, string>;
  threadId?: string;
};

export type RichTableColumnAlignment = "left" | "center" | "right" | null;

export type RichContentBlock =
  | { type: "paragraph"; parts: RichInlinePart[] }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; parts: RichInlinePart[] }
  | { type: "blockquote"; parts: RichInlinePart[] }
  | { type: "thematic-break"; reveal?: boolean }
  | {
      type: "list";
      items: RichInlinePart[][];
      checkedItems?: (boolean | null)[];
      hiddenItems?: boolean[];
      revealItems?: boolean[];
    }
  | {
      type: "ordered-list";
      items: RichInlinePart[][];
      hiddenItems?: boolean[];
      revealItems?: boolean[];
    }
  | {
      type: "table";
      alignments?: RichTableColumnAlignment[];
      headers: RichInlinePart[][];
      rows: RichInlinePart[][][];
    }
  | {
      type: "footnotes";
      items: { label: string; parts: RichInlinePart[] }[];
    }
  | { type: "code"; code: string; language: string | null; reveal?: boolean }
  | { type: "mermaid"; code: string; reveal?: boolean }
  | { type: "math"; html: string; source: string; reveal?: boolean };

export type RichInlinePart =
  | { type: "text"; text: string; reveal?: boolean }
  | { type: "line-break"; reveal?: boolean }
  | { type: "code"; text: string; reveal?: boolean }
  | { type: "strong"; parts: RichInlinePart[]; reveal?: boolean }
  | { type: "emphasis"; parts: RichInlinePart[]; reveal?: boolean }
  | { type: "strikethrough"; parts: RichInlinePart[]; reveal?: boolean }
  | { type: "html"; html: string; reveal?: boolean }
  | { type: "math"; html: string; source: string; reveal?: boolean }
  | { type: "footnote-ref"; label: string; index: number; reveal?: boolean }
  | {
      type: "link";
      href: string;
      label: string;
      external: boolean;
      citationLabel: string | null;
      reveal?: boolean;
    }
  | { type: "unsafe-link"; href: string; label: string; reveal?: boolean }
  | { type: "image"; src: string; alt: string; reveal?: boolean };

export type CitationSource = {
  href: string;
  label: string;
};

export type RichContentParseOptions = {
  streaming?: boolean;
};

type BlockOf<TType extends RichContentBlock["type"]> = Extract<RichContentBlock, { type: TType }>;
type PartOf<TType extends RichInlinePart["type"]> = Extract<RichInlinePart, { type: TType }>;

const SAFE_HREF_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];
const CODE_FENCE_RE = /^ {0,3}(?:```|~~~)/;
const INDENTED_CODE_RE = /^(?: {4}|\t)/;
const MAX_BLOCKQUOTE_DEPTH = 100;
const DEEP_BLOCKQUOTE_HINT_RE = new RegExp(
  `^(?:[ \\t]*>){${MAX_BLOCKQUOTE_DEPTH + 1}}`,
  "m",
);
const BLOCKQUOTE_PREFIX_RE = /^ {0,3}(?:[ \t]*>)+/;
const MAX_LIST_INDENT = 200;
const DEEP_INDENT_HINT_RE = new RegExp(`^[ \\t]{${MAX_LIST_INDENT + 1},}`, "m");
const FENCE_MARKER_RE = /^ {0,3}(`{3,}|~{3,})/;
const SAFE_INLINE_HTML_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "br",
  "code",
  "del",
  "div",
  "em",
  "i",
  "kbd",
  "mark",
  "p",
  "s",
  "span",
  "strong",
  "sub",
  "sup",
  "u",
]);
const VOID_HTML_TAGS = new Set(["br"]);
const INTERNAL_MARKER_TAGS = [
  "memory",
  "system-reminder",
  "human-input-response",
  "uploaded-files",
  "skill-context",
];
const INTERNAL_MARKER_RE = new RegExp(
  `</?(?:${INTERNAL_MARKER_TAGS.join("|")})(?:\\s[^>]*)?/?>`,
  "gi",
);
const LABELLED_DOTTED_ARROW_RE =
  /^(\s*)(.+?)\s*--\s*("[^"\n]+"|'[^'\n]+')\s*-\.->\s*(.+?)\s*$/;
const HTML_TAG_RE = /<\/?([a-z][a-z0-9-]*)(?:\s[^>]*)?\s*\/?>/gi;
const HTML_ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>`=]+)))?/g;
const TASK_LIST_ITEM_RE = /^\[([ xX])\]\s+(.*)$/;
const UNORDERED_LIST_ITEM_RE = /^\s*[-*](?:\s+(.*)|\s*)$/;
const ORDERED_LIST_ITEM_RE = /^\s*\d+[.)](?:\s+(.*)|\s*)$/;
const THEMATIC_BREAK_RE = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})$/;
const AUTOLINK_LITERAL_RE =
  /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+/gi;
const AUTOLINK_TRAILING_PUNCTUATION_RE = /[.,!?;:]$/;
const HARD_LINE_BREAK_RE = /( {2,}|\\)\n/g;
const SINGLE_LINE_DISPLAY_MATH_RE = /^ {0,3}\$\$(.+?)\$\$\s*$/;
const REFERENCE_DEFINITION_RE =
  /^ {0,3}\[([^\]\n]+)\]:[ \t]*(<[^>\n]+>|[^\s<>\n]+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?[ \t]*$/;
const FOOTNOTE_DEFINITION_RE = /^ {0,3}\[\^([^\]\n]+)\]:[ \t]*(.*)$/;
const FOOTNOTE_CONTINUATION_RE = /^(?: {2,}|\t)(.*)$/;
const ENTITY_RE = /^&(?:#(\d+)|#x([\da-fA-F]+)|([A-Za-z][A-Za-z\d]+));/;
const ESCAPABLE_MARKDOWN_PUNCTUATION_RE = /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/;
const NAMED_CHARACTER_REFERENCES: ReadonlyMap<string, string> = new Map([
  ["amp", "&"],
  ["apos", "'"],
  ["bull", "•"],
  ["copy", "©"],
  ["gt", ">"],
  ["hellip", "…"],
  ["laquo", "«"],
  ["ldquo", "“"],
  ["lsquo", "‘"],
  ["lt", "<"],
  ["mdash", "—"],
  ["middot", "·"],
  ["nbsp", "\u00A0"],
  ["ndash", "–"],
  ["quot", '"'],
  ["raquo", "»"],
  ["rdquo", "”"],
  ["reg", "®"],
  ["rsquo", "’"],
  ["trade", "™"],
]);
const KATEX_OPTIONS = {
  output: "html",
  strict: false,
  throwOnError: false,
} as const;

export function parseRichContent(
  content: string,
  context: RichContentContext = {},
  options: RichContentParseOptions = {},
): RichContentBlock[] {
  const blocks: RichContentBlock[] = [];
  const referenceContent = extractReferenceDefinitions(getSafeRichMarkdown(content));
  const lines = referenceContent.lines;
  const footnoteReferences: string[] = [];
  const richContext: RichContentContext = {
    ...context,
    footnoteDefinitions: referenceContent.footnotes,
    footnoteReferences,
    referenceDefinitions: referenceContent.definitions,
  };
  let paragraphLines: string[] = [];
  let listItems: { checked: boolean | null; content: string }[] = [];
  let orderedListItems: string[] = [];
  let codeFence: { fence: string; language: string | null; lines: string[] } | null = null;
  let mathBlock: string[] | null = null;

  function flushParagraph() {
    if (paragraphLines.length === 0) {
      return;
    }
    blocks.push({
      type: "paragraph",
      parts: parseRichInline(paragraphLines.join("\n"), richContext),
    });
    paragraphLines = [];
  }

  function flushList() {
    if (listItems.length === 0) {
      return;
    }
    const checkedItems = listItems.map((item) => item.checked);
    const hiddenItems = buildStreamingHiddenItems(
      listItems.map((item) => item.content),
      options,
    );
    blocks.push({
      type: "list",
      ...(checkedItems.some((checked) => checked !== null) ? { checkedItems } : {}),
      ...(hiddenItems.some(Boolean) ? { hiddenItems } : {}),
      items: listItems.map((item) => parseRichInline(item.content, richContext)),
    });
    listItems = [];
  }

  function flushOrderedList() {
    if (orderedListItems.length === 0) {
      return;
    }
    const hiddenItems = buildStreamingHiddenItems(orderedListItems, options);
    blocks.push({
      type: "ordered-list",
      ...(hiddenItems.some(Boolean) ? { hiddenItems } : {}),
      items: orderedListItems.map((item) => parseRichInline(item, richContext)),
    });
    orderedListItems = [];
  }

  function flushLooseBlocks() {
    flushParagraph();
    flushList();
    flushOrderedList();
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const fence = readFence(line);

    if (mathBlock) {
      if (line.trim() === "$$") {
        blocks.push({
          html: renderMathHtml(mathBlock.join("\n"), true),
          source: mathBlock.join("\n"),
          type: "math",
        });
        mathBlock = null;
      } else {
        mathBlock.push(line);
      }
      continue;
    }

    if (fence) {
      if (codeFence && isClosingFence(line, codeFence.fence)) {
        blocks.push(codeFenceBlock(codeFence.language, codeFence.lines.join("\n")));
        codeFence = null;
      } else if (!codeFence) {
        flushLooseBlocks();
        codeFence = { fence: fence.fence, language: fence.language, lines: [] };
      } else {
        codeFence.lines.push(line);
      }
      continue;
    }

    if (codeFence) {
      codeFence.lines.push(line);
      continue;
    }

    const singleLineDisplayMath = readSingleLineDisplayMath(line);
    if (singleLineDisplayMath !== null) {
      flushLooseBlocks();
      blocks.push({
        html: renderMathHtml(singleLineDisplayMath, true),
        source: singleLineDisplayMath,
        type: "math",
      });
      continue;
    }

    if (line.trim() === "$$") {
      flushLooseBlocks();
      mathBlock = [];
      continue;
    }

    if (isThematicBreak(line)) {
      flushLooseBlocks();
      blocks.push({ type: "thematic-break" });
      continue;
    }

    const nextLine = lines[lineIndex + 1] ?? "";
    if (isTableHeader(line, nextLine)) {
      flushLooseBlocks();
      const tableRows: string[][] = [];
      const columnCount = splitTableRow(line).length;
      const alignments = splitTableRow(nextLine).map(readTableDividerAlignment);
      lineIndex += 2;

      while (lineIndex < lines.length) {
        const rowLine = lines[lineIndex] ?? "";
        if (rowLine.trim() === "" || !rowLine.includes("|")) {
          lineIndex -= 1;
          break;
        }
        tableRows.push(normalizeTableRow(splitTableRow(rowLine), columnCount));
        lineIndex += 1;
      }

      blocks.push({
        ...(alignments.some((alignment) => alignment !== null) ? { alignments } : {}),
        headers: splitTableRow(line).map((cell) => parseRichInline(cell, richContext)),
        rows: tableRows.map((row) => row.map((cell) => parseRichInline(cell, richContext))),
        type: "table",
      });
      continue;
    }

    const heading = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/.exec(line);
    if (heading) {
      flushLooseBlocks();
      blocks.push({
        level: heading[1]!.length as 1 | 2 | 3 | 4 | 5 | 6,
        parts: parseRichInline(normalizeAtxHeadingText(heading[2] ?? ""), richContext),
        type: "heading",
      });
      continue;
    }

    const blockquote = /^>\s?(.+)$/.exec(line);
    if (blockquote) {
      flushLooseBlocks();
      blocks.push({
        parts: parseRichInline(blockquote[1] ?? "", richContext),
        type: "blockquote",
      });
      continue;
    }

    const listItem = UNORDERED_LIST_ITEM_RE.exec(line);
    if (listItem) {
      flushParagraph();
      flushOrderedList();
      listItems.push(parseListItem(listItem[1] ?? ""));
      continue;
    }

    const orderedListItem = ORDERED_LIST_ITEM_RE.exec(line);
    if (orderedListItem) {
      flushParagraph();
      flushList();
      orderedListItems.push(orderedListItem[1] ?? "");
      continue;
    }

    if (line.trim() === "") {
      const nextLine = lines[lineIndex + 1] ?? "";
      if ((listItems.length > 0 || orderedListItems.length > 0) && isListMarkerLine(nextLine)) {
        continue;
      }
      flushLooseBlocks();
      continue;
    }

    flushList();
    flushOrderedList();
    paragraphLines.push(line);
  }

  if (codeFence) {
    blocks.push(codeFenceBlock(codeFence.language, codeFence.lines.join("\n")));
  }
  if (mathBlock) {
    blocks.push({
      html: renderMathHtml(mathBlock.join("\n"), true),
      source: mathBlock.join("\n"),
      type: "math",
    });
  }
  flushLooseBlocks();

  const footnotes = buildFootnoteBlock(referenceContent, footnoteReferences, context);
  if (footnotes) {
    blocks.push(footnotes);
  }

  return blocks;
}

function extractReferenceDefinitions(markdown: string): {
  definitions: ReadonlyMap<string, string>;
  footnotes: ReadonlyMap<string, string>;
  lines: string[];
} {
  const definitions = new Map<string, string>();
  const footnotes = new Map<string, string>();
  const lines: string[] = [];
  let fenceMarker: string | null = null;
  let currentFootnoteLabel: string | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    fenceMarker = readNextFenceMarker(line, fenceMarker);
    if (fenceMarker !== null) {
      lines.push(line);
      currentFootnoteLabel = null;
      continue;
    }

    if (currentFootnoteLabel) {
      const continuation = FOOTNOTE_CONTINUATION_RE.exec(line);
      if (continuation) {
        const previous = footnotes.get(currentFootnoteLabel) ?? "";
        const next = continuation[1] ?? "";
        footnotes.set(currentFootnoteLabel, previous ? `${previous}\n${next}` : next);
        lines.push("");
        continue;
      }
      currentFootnoteLabel = null;
    }

    if (INDENTED_CODE_RE.test(line)) {
      lines.push(line);
      continue;
    }

    const footnote = FOOTNOTE_DEFINITION_RE.exec(line);
    if (footnote) {
      const label = normalizeReferenceLabel(footnote[1] ?? "");
      const text = footnote[2] ?? "";
      if (label && !footnotes.has(label)) {
        footnotes.set(label, text);
        currentFootnoteLabel = label;
      }
      lines.push("");
      continue;
    }

    const definition = REFERENCE_DEFINITION_RE.exec(line);
    if (!definition) {
      lines.push(line);
      continue;
    }

    const label = normalizeReferenceLabel(definition[1] ?? "");
    const href = normalizeReferenceHref(definition[2] ?? "");
    if (label && href && !definitions.has(label)) {
      definitions.set(label, href);
    }
    lines.push("");
  }

  return { definitions, footnotes, lines };
}

function buildFootnoteBlock(
  referenceContent: {
    definitions: ReadonlyMap<string, string>;
    footnotes: ReadonlyMap<string, string>;
  },
  references: readonly string[],
  context: RichContentContext,
): BlockOf<"footnotes"> | null {
  const { definitions, footnotes } = referenceContent;
  if (footnotes.size === 0 || references.length === 0) {
    return null;
  }

  const seen = new Set<string>();
  const items: BlockOf<"footnotes">["items"] = [];
  for (const label of references) {
    if (seen.has(label)) {
      continue;
    }
    const content = footnotes.get(label);
    if (content === undefined) {
      continue;
    }
    seen.add(label);
    items.push({
      label,
      parts: parseRichInline(content, {
        ...context,
        footnoteDefinitions: footnotes,
        referenceDefinitions: definitions,
      }),
    });
  }

  return items.length > 0 ? { items, type: "footnotes" } : null;
}

function normalizeReferenceLabel(label: string): string {
  return decodeCommonMarkVisibleText(label).trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeReferenceHref(href: string): string {
  if (href.startsWith("<") && href.endsWith(">")) {
    return href.slice(1, -1);
  }
  return href;
}

function normalizeAtxHeadingText(text: string): string {
  return text.replace(/[ \t]+#+[ \t]*$/, "").trim();
}

function buildStreamingHiddenItems(
  items: readonly string[],
  options: RichContentParseOptions,
): boolean[] {
  return items.map((item, index) => {
    if (!options.streaming || item.trim() !== "") {
      return false;
    }
    return !items.slice(index + 1).some((laterItem) => laterItem.trim() !== "");
  });
}

function isListMarkerLine(line: string): boolean {
  return UNORDERED_LIST_ITEM_RE.test(line) || ORDERED_LIST_ITEM_RE.test(line);
}

function parseListItem(content: string): { checked: boolean | null; content: string } {
  const taskListItem = TASK_LIST_ITEM_RE.exec(content);
  if (!taskListItem) {
    return { checked: null, content };
  }
  return {
    checked: (taskListItem[1] ?? "").toLowerCase() === "x",
    content: taskListItem[2] ?? "",
  };
}

function isThematicBreak(line: string): boolean {
  return THEMATIC_BREAK_RE.test(line);
}

function readSingleLineDisplayMath(line: string): string | null {
  const match = SINGLE_LINE_DISPLAY_MATH_RE.exec(line);
  const source = match?.[1]?.trim();
  return source ? source : null;
}

export function parseRichInline(
  content: string,
  context: RichContentContext = {},
): RichInlinePart[] {
  const parts: RichInlinePart[] = [];
  const normalizedContent = normalizeLatexMathDelimiters(stripLeakedSystemTags(content));
  const htmlRanges = findHtmlRanges(normalizedContent);
  const sanitizedWholeHtml = sanitizeInlineHtml(normalizedContent);
  if (
    sanitizedWholeHtml !== null &&
    !hasInlineTokenOutsideHtml(normalizedContent, htmlRanges, context)
  ) {
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
    if (token) {
      parts.push(token.part);
      cursor = token.end;
      continue;
    }

    const nextTokenIndex = findNextInlineTokenIndex(normalizedContent, cursor + 1, htmlRanges);
    pushHtmlAwareTextParts(parts, normalizedContent.slice(cursor, nextTokenIndex), context);
    cursor = nextTokenIndex;
  }
  return parts;
}

type InlineToken = {
  end: number;
  part: RichInlinePart;
};

function readInlineToken(
  text: string,
  index: number,
  context: RichContentContext,
): InlineToken | null {
  if (isEscapedMarkdownPunctuation(text, index)) {
    return null;
  }
  return (
    readMarkdownLinkToken(text, index, context) ??
    readFootnoteReferenceToken(text, index, context) ??
    readInlineCodeToken(text, index) ??
    readWrappedInlineToken(text, index, "~~", "strikethrough", context) ??
    readMathToken(text, index) ??
    readWrappedInlineToken(text, index, "**", "strong", context) ??
    readWrappedInlineToken(text, index, "*", "emphasis", context)
  );
}

function readFootnoteReferenceToken(
  text: string,
  index: number,
  context: RichContentContext,
): InlineToken | null {
  if (!context.footnoteDefinitions || text[index] !== "[" || text[index + 1] !== "^") {
    return null;
  }

  const labelEnd = text.indexOf("]", index + 2);
  if (labelEnd === -1) {
    return null;
  }

  const label = normalizeReferenceLabel(text.slice(index + 2, labelEnd));
  if (!label || !context.footnoteDefinitions.has(label)) {
    return null;
  }

  const references = context.footnoteReferences;
  let referenceIndex = references?.indexOf(label) ?? -1;
  if (referenceIndex === -1) {
    references?.push(label);
    referenceIndex = references?.length ? references.length - 1 : 0;
  }

  return {
    end: labelEnd + 1,
    part: {
      index: referenceIndex + 1,
      label,
      type: "footnote-ref",
    },
  };
}

function readMarkdownLinkToken(
  text: string,
  index: number,
  context: RichContentContext,
): InlineToken | null {
  const isImage = text[index] === "!" && text[index + 1] === "[";
  const labelStart = isImage ? index + 2 : index + 1;
  if (!isImage && text[index] !== "[") {
    return null;
  }

  const labelEnd = text.indexOf("]", labelStart);
  if (labelEnd === -1) {
    return null;
  }

  const rawLabel = text.slice(labelStart, labelEnd);
  const label = decodeCommonMarkVisibleText(rawLabel);
  const directHref = readDirectMarkdownHref(text, labelEnd);
  const referenceHref = directHref
    ? null
    : readReferenceMarkdownHref(text, rawLabel, labelEnd, context.referenceDefinitions);
  const hrefToken = directHref ?? referenceHref;
  if (!hrefToken) {
    return null;
  }

  const { end, href } = hrefToken;
  if (!href) {
    return null;
  }

  if (isImage) {
    return {
      end,
      part: {
        alt: label,
        src: resolveImageSrc(href, context),
        type: "image",
      },
    };
  }

  if (!isSafeHref(href)) {
    return {
      end,
      part: { href, label, type: "unsafe-link" },
    };
  }

  const resolvedHref = resolveLinkHref(href, context);
  const citationLabel = label.startsWith("citation:")
    ? label.slice("citation:".length)
    : null;
  return {
    end,
    part: {
      citationLabel,
      external: /^https?:\/\//.test(resolvedHref),
      href: resolvedHref,
      label,
      type: "link",
    },
  };
}

function readDirectMarkdownHref(
  text: string,
  labelEnd: number,
): { end: number; href: string } | null {
  if (text[labelEnd + 1] !== "(") {
    return null;
  }
  const hrefStart = labelEnd + 2;
  const hrefEnd = text.indexOf(")", hrefStart);
  if (hrefEnd === -1) {
    return null;
  }

  const href = text.slice(hrefStart, hrefEnd);
  if (!href || /\s/.test(href)) {
    return null;
  }
  return { end: hrefEnd + 1, href };
}

function readReferenceMarkdownHref(
  text: string,
  label: string,
  labelEnd: number,
  definitions: ReadonlyMap<string, string> | undefined,
): { end: number; href: string } | null {
  if (!definitions || definitions.size === 0) {
    return null;
  }

  if (text[labelEnd + 1] === "[") {
    const referenceEnd = text.indexOf("]", labelEnd + 2);
    if (referenceEnd === -1) {
      return null;
    }
    const referenceLabel = text.slice(labelEnd + 2, referenceEnd) || label;
    const href = definitions.get(normalizeReferenceLabel(referenceLabel));
    return href ? { end: referenceEnd + 1, href } : null;
  }

  const href = definitions.get(normalizeReferenceLabel(label));
  return href ? { end: labelEnd + 1, href } : null;
}

function readInlineCodeToken(text: string, index: number): InlineToken | null {
  if (text[index] !== "`") {
    return null;
  }
  const end = text.indexOf("`", index + 1);
  if (end === -1) {
    return null;
  }
  return {
    end: end + 1,
    part: { text: text.slice(index + 1, end), type: "code" },
  };
}

function readWrappedInlineToken(
  text: string,
  index: number,
  delimiter: "**" | "*" | "~~",
  type: "strong" | "emphasis" | "strikethrough",
  context: RichContentContext,
): InlineToken | null {
  if (!text.startsWith(delimiter, index)) {
    return null;
  }
  if (delimiter === "~~" && isPartOfLongerTildeRun(text, index)) {
    return null;
  }
  if (delimiter === "*" && (text[index - 1] === "*" || text[index + 1] === "*")) {
    return null;
  }

  const contentStart = index + delimiter.length;
  const contentEnd = findClosingInlineDelimiter(text, delimiter, contentStart);
  if (contentEnd === -1) {
    return null;
  }

  const inner = text.slice(contentStart, contentEnd);
  if (!isValidWrappedInlineContent(inner)) {
    return null;
  }
  return {
    end: contentEnd + delimiter.length,
    part: {
      parts: parseRichInline(inner, context),
      type,
    },
  };
}

function readMathToken(text: string, index: number): InlineToken | null {
  if (text[index] !== "$") {
    return null;
  }
  const end = text.indexOf("$", index + 1);
  if (end === -1) {
    return null;
  }
  const source = text.slice(index + 1, end).trim();
  if (!source || source.includes("\n")) {
    return null;
  }
  return {
    end: end + 1,
    part: {
      html: renderMathHtml(source, false),
      source,
      type: "math",
    },
  };
}

function findClosingInlineDelimiter(
  text: string,
  delimiter: "**" | "*" | "~~",
  start: number,
): number {
  let cursor = start;
  while (cursor < text.length) {
    const index = text.indexOf(delimiter, cursor);
    if (index === -1 || text.slice(cursor, index).includes("\n")) {
      return -1;
    }
    if (delimiter === "~~" && isPartOfLongerTildeRun(text, index)) {
      cursor = index + 1;
      continue;
    }
    if (delimiter !== "*" || text[index + 1] !== "*") {
      return index;
    }
    cursor = index + 1;
  }
  return -1;
}

function isPartOfLongerTildeRun(text: string, index: number): boolean {
  return text[index - 1] === "~" || text[index + 2] === "~";
}

function isValidWrappedInlineContent(content: string): boolean {
  return content.trim() === content && content.length > 0;
}

function findNextInlineTokenIndex(
  text: string,
  start: number,
  htmlRanges: readonly TextRange[],
): number {
  for (let index = start; index < text.length; index += 1) {
    if (findRangeAt(index, htmlRanges)) {
      return index;
    }
    const char = text[index];
    if (isEscapedMarkdownPunctuation(text, index)) {
      continue;
    }
    if (
      char === "[" ||
      char === "`" ||
      char === "$" ||
      char === "*" ||
      (char === "!" && text[index + 1] === "[") ||
      (char === "~" && text[index + 1] === "~")
    ) {
      return index;
    }
  }
  return text.length;
}

function hasInlineTokenOutsideHtml(
  text: string,
  htmlRanges: readonly TextRange[],
  context: RichContentContext,
): boolean {
  let cursor = 0;
  while (cursor < text.length) {
    const htmlRange = findRangeAt(cursor, htmlRanges);
    if (htmlRange) {
      cursor = htmlRange.end;
      continue;
    }
    if (readInlineToken(text, cursor, context)) {
      return true;
    }
    cursor += 1;
  }
  return false;
}

export function isSafeHref(href: string | undefined): boolean {
  if (typeof href !== "string" || href.length === 0) {
    return false;
  }
  if (href.startsWith("#")) {
    return true;
  }
  if (/^(\/\/|\\\\)/.test(href)) {
    return false;
  }
  try {
    const parsed = new URL(href, "https://dummy.example/");
    return SAFE_HREF_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function collectCitationSources(blocks: readonly RichContentBlock[]): CitationSource[] {
  const seen = new Set<string>();
  const sources: CitationSource[] = [];
  for (const part of flatInlineParts(blocks)) {
    if (part.type !== "link" || !part.citationLabel) {
      continue;
    }
    const key = `${part.citationLabel}\n${part.href}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    sources.push({ href: part.href, label: part.citationLabel });
  }
  return sources;
}

export function applyStreamingReveal(
  blocks: readonly RichContentBlock[],
  previousBlocks: readonly RichContentBlock[],
): RichContentBlock[] {
  return blocks.map((block, index) => revealBlock(block, previousBlocks[index]));
}

function revealBlock(
  block: RichContentBlock,
  previousBlock: RichContentBlock | undefined,
): RichContentBlock {
  if (!previousBlock || previousBlock.type !== block.type) {
    return markBlockReveal(block);
  }
  if (block.type === "paragraph") {
    const previous = previousBlock as BlockOf<"paragraph">;
    return {
      ...block,
      parts: revealInlineParts(block.parts, previous.parts),
    };
  }
  if (block.type === "heading") {
    const previous = previousBlock as BlockOf<"heading">;
    return {
      ...block,
      parts: revealInlineParts(block.parts, previous.parts),
    };
  }
  if (block.type === "blockquote") {
    const previous = previousBlock as BlockOf<"blockquote">;
    return {
      ...block,
      parts: revealInlineParts(block.parts, previous.parts),
    };
  }
  if (block.type === "list" || block.type === "ordered-list") {
    const previous = previousBlock as BlockOf<"list" | "ordered-list">;
    const items = block.items.map((item, index) =>
      revealInlineParts(item, previous.items[index] ?? []),
    );
    return {
      ...block,
      items,
      revealItems: items.map((item, index) => {
        if (block.hiddenItems?.[index]) {
          return false;
        }
        if (item.some((part) => part.reveal)) {
          return true;
        }
        return previous.hiddenItems?.[index] === true && item.length > 0;
      }),
    };
  }
  if (block.type === "table") {
    const previous = previousBlock as BlockOf<"table">;
    return {
      ...block,
      headers: block.headers.map((header, index) =>
        revealInlineParts(header, previous.headers[index] ?? []),
      ),
      rows: block.rows.map((row, rowIndex) =>
        row.map((cell, cellIndex) =>
          revealInlineParts(cell, previous.rows[rowIndex]?.[cellIndex] ?? []),
        ),
      ),
    };
  }
  if (block.type === "footnotes") {
    const previous = previousBlock as BlockOf<"footnotes">;
    return {
      ...block,
      items: block.items.map((item, index) => ({
        ...item,
        parts: revealInlineParts(item.parts, previous.items[index]?.parts ?? []),
      })),
    };
  }
  if (block.type === "code") {
    const previous = previousBlock as BlockOf<"code">;
    return { ...block, reveal: block.code !== previous.code };
  }
  if (block.type === "mermaid") {
    const previous = previousBlock as BlockOf<"mermaid">;
    return { ...block, reveal: block.code !== previous.code };
  }
  if (block.type === "thematic-break") {
    return block;
  }
  const previous = previousBlock as BlockOf<"math">;
  return { ...block, reveal: block.source !== previous.source };
}

function markBlockReveal(block: RichContentBlock): RichContentBlock {
  if (block.type === "paragraph") {
    return { ...block, parts: block.parts.map(markInlinePartReveal) };
  }
  if (block.type === "heading") {
    return { ...block, parts: block.parts.map(markInlinePartReveal) };
  }
  if (block.type === "blockquote") {
    return { ...block, parts: block.parts.map(markInlinePartReveal) };
  }
  if (block.type === "list" || block.type === "ordered-list") {
    return { ...block, items: block.items.map((item) => item.map(markInlinePartReveal)) };
  }
  if (block.type === "table") {
    return {
      ...block,
      headers: block.headers.map((header) => header.map(markInlinePartReveal)),
      rows: block.rows.map((row) => row.map((cell) => cell.map(markInlinePartReveal))),
    };
  }
  if (block.type === "footnotes") {
    return {
      ...block,
      items: block.items.map((item) => ({
        ...item,
        parts: item.parts.map(markInlinePartReveal),
      })),
    };
  }
  return { ...block, reveal: true };
}

function revealInlineParts(
  parts: readonly RichInlinePart[],
  previousParts: readonly RichInlinePart[],
): RichInlinePart[] {
  return parts.flatMap((part, index) => revealInlinePart(part, previousParts[index]));
}

function revealInlinePart(
  part: RichInlinePart,
  previousPart: RichInlinePart | undefined,
): RichInlinePart[] {
  if (!previousPart || previousPart.type !== part.type) {
    return [markInlinePartReveal(part)];
  }
  if (part.type === "text" || part.type === "code") {
    const previous = previousPart as PartOf<"text" | "code">;
    return revealTextLikePart(part, previous.text);
  }
  if (part.type === "line-break") {
    return [part];
  }
  if (part.type === "strong" || part.type === "emphasis" || part.type === "strikethrough") {
    const previous = previousPart as PartOf<"strong" | "emphasis" | "strikethrough">;
    const parts = revealInlineParts(part.parts, previous.parts);
    return parts.some((child) => child.reveal) ? [{ ...part, parts, reveal: true }] : [part];
  }
  if (part.type === "unsafe-link") {
    const previous = previousPart as PartOf<"unsafe-link">;
    return samePart(part.label, previous.label) ? [part] : [{ ...part, reveal: true }];
  }
  if (part.type === "link") {
    const previous = previousPart as PartOf<"link">;
    const sameLink =
      part.href === previous.href &&
      part.label === previous.label &&
      part.citationLabel === previous.citationLabel;
    return sameLink ? [part] : [{ ...part, reveal: true }];
  }
  if (part.type === "image") {
    const previous = previousPart as PartOf<"image">;
    return part.src === previous.src && part.alt === previous.alt
      ? [part]
      : [{ ...part, reveal: true }];
  }
  if (part.type === "html") {
    const previous = previousPart as PartOf<"html">;
    return samePart(part.html, previous.html) ? [part] : [{ ...part, reveal: true }];
  }
  if (part.type === "footnote-ref") {
    const previous = previousPart as PartOf<"footnote-ref">;
    return part.label === previous.label && part.index === previous.index
      ? [part]
      : [{ ...part, reveal: true }];
  }
  const previous = previousPart as PartOf<"math">;
  return samePart(part.source, previous.source) ? [part] : [{ ...part, reveal: true }];
}

function revealTextLikePart<TPart extends Extract<RichInlinePart, { text: string }>>(
  part: TPart,
  previousText: string,
): TPart[] {
  if (part.text === previousText) {
    return [part];
  }
  if (previousText && part.text.startsWith(previousText)) {
    const suffix = part.text.slice(previousText.length);
    return [
      { ...part, text: previousText },
      { ...part, reveal: true, text: suffix },
    ].filter((item) => item.text.length > 0);
  }
  return [{ ...part, reveal: true }];
}

function markInlinePartReveal(part: RichInlinePart): RichInlinePart {
  if (part.type === "strong" || part.type === "emphasis" || part.type === "strikethrough") {
    return {
      ...part,
      parts: part.parts.map(markInlinePartReveal),
      reveal: true,
    };
  }
  return { ...part, reveal: true };
}

function samePart(current: string, previous: string): boolean {
  return current === previous;
}

function pushTextPart(parts: RichInlinePart[], text: string) {
  const visibleText = decodeCommonMarkVisibleText(text);
  if (!visibleText) {
    return;
  }

  const previousPart = parts.at(-1);
  if (previousPart?.type === "text" && !previousPart.reveal) {
    previousPart.text += visibleText;
    return;
  }

  parts.push({ text: visibleText, type: "text" });
}

function decodeCommonMarkVisibleText(text: string): string {
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

  return NAMED_CHARACTER_REFERENCES.get(named ?? "") ?? entity[0];
}

function isValidCharacterReferenceCode(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value > 0 &&
    value <= 0x10ffff &&
    !(value >= 0xd800 && value <= 0xdfff)
  );
}

function isEscapedMarkdownPunctuation(text: string, index: number): boolean {
  const char = text[index] ?? "";
  if (!ESCAPABLE_MARKDOWN_PUNCTUATION_RE.test(char)) {
    return false;
  }

  let backslashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

function pushTextWithAutolinks(
  parts: RichInlinePart[],
  text: string,
  context: RichContentContext,
) {
  AUTOLINK_LITERAL_RE.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = AUTOLINK_LITERAL_RE.exec(text)) !== null) {
    const rawUrl = match[0] ?? "";
    if (match.index > cursor) {
      pushTextPart(parts, text.slice(cursor, match.index));
    }

    const { href, label, trailingText } = normalizeAutolinkLiteral(rawUrl);
    if (href.length > 0 && isSafeHref(href)) {
      const resolvedHref = resolveLinkHref(href, context);
      parts.push({
        citationLabel: null,
        external: /^https?:\/\//.test(resolvedHref),
        href: resolvedHref,
        label,
        type: "link",
      });
      pushTextPart(parts, trailingText);
    } else {
      pushTextPart(parts, rawUrl);
    }
    cursor = AUTOLINK_LITERAL_RE.lastIndex;
  }

  if (cursor < text.length) {
    pushTextPart(parts, text.slice(cursor));
  }
}

function pushTextWithHardBreaks(
  parts: RichInlinePart[],
  text: string,
  context: RichContentContext,
) {
  HARD_LINE_BREAK_RE.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = HARD_LINE_BREAK_RE.exec(text)) !== null) {
    if (match.index > cursor) {
      pushTextWithAutolinks(parts, text.slice(cursor, match.index), context);
    }
    parts.push({ type: "line-break" });
    cursor = HARD_LINE_BREAK_RE.lastIndex;
  }

  if (cursor < text.length) {
    pushTextWithAutolinks(parts, text.slice(cursor), context);
  }
}

function normalizeAutolinkLiteral(rawUrl: string): {
  href: string;
  label: string;
  trailingText: string;
} {
  let label = rawUrl;
  let trailingText = "";

  while (label.length > 0 && AUTOLINK_TRAILING_PUNCTUATION_RE.test(label)) {
    trailingText = label.slice(-1) + trailingText;
    label = label.slice(0, -1);
  }

  while (hasUnmatchedTrailingBracket(label)) {
    trailingText = label.slice(-1) + trailingText;
    label = label.slice(0, -1);
  }

  if (/^www\./i.test(label)) {
    return { href: `http://${label}`, label, trailingText };
  }
  if (!/^[a-z][a-z\d+.-]*:/i.test(label) && label.includes("@")) {
    return { href: `mailto:${label}`, label, trailingText };
  }
  return { href: label, label, trailingText };
}

function hasUnmatchedTrailingBracket(text: string): boolean {
  const pairs: Record<string, string> = {
    ")": "(",
    "]": "[",
    "}": "{",
  };
  const closing = text.slice(-1);
  const opening = pairs[closing];
  if (!opening) {
    return false;
  }
  return countCharacters(text, closing) > countCharacters(text, opening);
}

function countCharacters(text: string, target: string): number {
  let count = 0;
  for (const char of text) {
    if (char === target) {
      count += 1;
    }
  }
  return count;
}

function pushHtmlAwareTextParts(
  parts: RichInlinePart[],
  text: string,
  context: RichContentContext,
) {
  const sanitizedHtml = sanitizeInlineHtml(text);
  if (sanitizedHtml === null) {
    pushTextWithHardBreaks(parts, text, context);
    return;
  }
  if (sanitizedHtml) {
    parts.push({ html: sanitizedHtml, type: "html" });
  }
}

type TextRange = {
  end: number;
  start: number;
};

function findHtmlRanges(text: string): TextRange[] {
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
      if (openIndex === -1) {
        ranges.push({ start, end });
        continue;
      }
      const [openTag] = openTags.splice(openIndex, 1);
      if (openTag) {
        ranges.push({ start: openTag.start, end });
      }
      continue;
    }

    if (isSelfClosing) {
      ranges.push({ start, end });
      continue;
    }
    openTags.push({ name: tagName, start });
  }

  ranges.push(...openTags.map((tag) => ({ start: tag.start, end: tag.start + 1 })));
  return ranges;
}

function findRangeAt(index: number, ranges: readonly TextRange[]): TextRange | null {
  return ranges.find((range) => index >= range.start && index < range.end) ?? null;
}

function renderMathHtml(source: string, displayMode: boolean): string {
  return katex.renderToString(source, {
    ...KATEX_OPTIONS,
    displayMode,
  });
}

type MathDelimiter = {
  close: "\\)" | "\\]";
  replacement: "$" | "$$";
};

type DelimiterState = {
  inlineCodeDelimiterLength: number | null;
  openBlock: MathDelimiter | null;
};

function consumeBacktickRun(line: string, index: number): number {
  let runLength = 0;
  while (line[index + runLength] === "`") {
    runLength += 1;
  }
  return runLength;
}

function convertLatexDelimitersInLine(
  line: string,
  state: DelimiterState,
): { line: string; state: DelimiterState } {
  let result = "";
  let i = 0;
  let inlineCodeDelimiterLength = state.inlineCodeDelimiterLength;
  let currentBlock = state.openBlock;

  while (i < line.length) {
    if (line[i] === "`") {
      const runLength = consumeBacktickRun(line, i);
      result += line.slice(i, i + runLength);
      if (!currentBlock) {
        if (inlineCodeDelimiterLength === null) {
          inlineCodeDelimiterLength = runLength;
        } else if (runLength === inlineCodeDelimiterLength) {
          inlineCodeDelimiterLength = null;
        }
      }
      i += runLength;
      continue;
    }

    const two = line.slice(i, i + 2);
    const inInlineCode = inlineCodeDelimiterLength !== null;
    if (two === "\\\\" && !inInlineCode) {
      result += two;
      i += 2;
      continue;
    }
    if (!inInlineCode && currentBlock?.close === two) {
      result += currentBlock.replacement;
      currentBlock = null;
      i += 2;
      continue;
    }
    if (!inInlineCode && !currentBlock && (two === "\\(" || two === "\\[")) {
      const isDisplay = two === "\\[";
      currentBlock = {
        close: isDisplay ? "\\]" : "\\)",
        replacement: isDisplay ? "$$" : "$",
      };
      result += currentBlock.replacement;
      i += 2;
      continue;
    }

    result += line[i];
    i += 1;
  }

  return {
    line: result,
    state: { inlineCodeDelimiterLength, openBlock: currentBlock },
  };
}

export function normalizeLatexMathDelimiters(markdown: string): string {
  if (!/[\\][([\])]/.test(markdown)) {
    return markdown;
  }

  let insideFence = false;
  let mathState: DelimiterState = {
    inlineCodeDelimiterLength: null,
    openBlock: null,
  };

  return markdown
    .split("\n")
    .map((line) => {
      if (CODE_FENCE_RE.test(line) && !mathState.openBlock) {
        insideFence = !insideFence;
        return line;
      }
      if (insideFence || (INDENTED_CODE_RE.test(line) && !mathState.openBlock)) {
        return line;
      }
      const converted = convertLatexDelimitersInLine(line, mathState);
      mathState = converted.state;
      return converted.line;
    })
    .join("\n");
}

function hasUnescapedTexComment(line: string): boolean {
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] !== "%") {
      continue;
    }
    let backslashCount = 0;
    for (let j = i - 1; j >= 0 && line[j] === "\\"; j -= 1) {
      backslashCount += 1;
    }
    if (backslashCount % 2 === 0) {
      return true;
    }
  }
  return false;
}

function flattenDisplayMathBody(lines: string[]): string[] {
  if (lines.some(hasUnescapedTexComment)) {
    return lines;
  }
  return [lines.map((line) => line.trim()).join(" ")];
}

export function compactDisplayMathBlocks(markdown: string): string {
  if (!markdown.includes("$$")) {
    return markdown;
  }

  const output: string[] = [];
  let insideFence = false;
  let mathLines: string[] | null = null;

  for (const line of markdown.split("\n")) {
    if (CODE_FENCE_RE.test(line) && mathLines === null) {
      insideFence = !insideFence;
      output.push(line);
      continue;
    }
    if (insideFence || (INDENTED_CODE_RE.test(line) && mathLines === null)) {
      output.push(line);
      continue;
    }
    if (line.trim() === "$$") {
      if (mathLines === null) {
        mathLines = [];
      } else {
        output.push("$$", ...flattenDisplayMathBody(mathLines), "$$");
        mathLines = null;
      }
      continue;
    }
    if (mathLines !== null) {
      mathLines.push(line);
      continue;
    }
    output.push(line);
  }

  if (mathLines !== null) {
    output.push("$$", ...mathLines);
  }
  return output.join("\n");
}

export function normalizeStreamdownMathMarkdown(markdown: string): string {
  return compactDisplayMathBlocks(normalizeLatexMathDelimiters(markdown));
}

export function capBlockquoteNesting(markdown: string): string {
  if (!DEEP_BLOCKQUOTE_HINT_RE.test(markdown)) {
    return markdown;
  }

  let fenceMarker: string | null = null;
  return markdown
    .split("\n")
    .map((line) => {
      fenceMarker = readNextFenceMarker(line, fenceMarker);
      if (fenceMarker !== null || INDENTED_CODE_RE.test(line)) {
        return line;
      }
      const match = BLOCKQUOTE_PREFIX_RE.exec(line);
      if (!match) {
        return line;
      }

      const prefix = match[0] ?? "";
      let depth = 0;
      for (let i = 0; i < prefix.length; i += 1) {
        if (prefix[i] !== ">") {
          continue;
        }
        depth += 1;
        if (depth > MAX_BLOCKQUOTE_DEPTH) {
          return line.slice(0, i) + line.slice(prefix.length);
        }
      }
      return line;
    })
    .join("\n");
}

export function capListNesting(markdown: string): string {
  if (!DEEP_INDENT_HINT_RE.test(markdown)) {
    return markdown;
  }

  let fenceMarker: string | null = null;
  return markdown
    .split("\n")
    .map((line) => {
      fenceMarker = readNextFenceMarker(line, fenceMarker);
      if (fenceMarker !== null) {
        return line;
      }
      const whitespace = /^[ \t]*/.exec(line)?.[0] ?? "";
      if (whitespace.length <= MAX_LIST_INDENT) {
        return line;
      }
      return " ".repeat(MAX_LIST_INDENT) + line.slice(whitespace.length);
    })
    .join("\n");
}

export function capMarkdownNesting(markdown: string): string {
  return capListNesting(capBlockquoteNesting(markdown));
}

export function getSafeRichMarkdown(markdown: string): string {
  return normalizeStreamdownMathMarkdown(
    capMarkdownNesting(stripLeakedSystemTags(markdown)),
  );
}

export function stripLeakedSystemTags(markdown: string): string {
  let fenceMarker: string | null = null;
  return markdown
    .split("\n")
    .map((line) => {
      fenceMarker = readNextFenceMarker(line, fenceMarker);
      if (fenceMarker !== null || INDENTED_CODE_RE.test(line)) {
        return line;
      }
      return line.replace(INTERNAL_MARKER_RE, "");
    })
    .join("\n");
}

export function normalizeMermaidCode(code: string): string {
  return code
    .split("\n")
    .map((line) =>
      line.replace(
        LABELLED_DOTTED_ARROW_RE,
        (
          _match,
          indent: string,
          source: string,
          label: string,
          target: string,
        ) => `${indent}${source} -. ${label} .-> ${target}`,
      ),
    )
    .join("\n");
}

function sanitizeInlineHtml(text: string): string | null {
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

  if (!sawHtmlTag) {
    return null;
  }

  result += escapeHtml(text.slice(cursor));
  return sawAllowedTag ? result : stripHtmlTags(text);
}

function sanitizeHtmlTag(rawTag: string, tagName: string): string {
  const isClosing = /^<\//.test(rawTag);
  if (isClosing) {
    return `</${tagName}>`;
  }
  if (VOID_HTML_TAGS.has(tagName)) {
    return `<${tagName}>`;
  }
  if (tagName !== "a") {
    return `<${tagName}>`;
  }

  const href = readHtmlAttribute(rawTag, "href");
  if (href === undefined || !isSafeHref(href)) {
    return "<a>";
  }
  const safeHref = escapeHtmlAttribute(href);
  const external = /^https?:\/\//.test(href);
  const targetAttrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
  return `<a href="${safeHref}"${targetAttrs}>`;
}

function readHtmlAttribute(rawTag: string, name: string): string | undefined {
  HTML_ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HTML_ATTR_RE.exec(rawTag)) !== null) {
    if ((match[1] ?? "").toLowerCase() !== name) {
      continue;
    }
    return match[3] ?? match[4] ?? match[5] ?? "";
  }
  return undefined;
}

function stripHtmlTags(text: string): string {
  return text.replace(HTML_TAG_RE, "");
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlAttribute(text: string): string {
  return escapeHtml(text).replaceAll('"', "&quot;");
}

function flatInlineParts(blocks: readonly RichContentBlock[]): RichInlinePart[] {
  const parts: RichInlinePart[] = [];
  for (const block of blocks) {
    if (block.type === "paragraph") {
      parts.push(...block.parts);
    } else if (block.type === "heading" || block.type === "blockquote") {
      parts.push(...block.parts);
    } else if (block.type === "list") {
      for (const item of block.items) {
        parts.push(...item);
      }
    } else if (block.type === "ordered-list") {
      for (const item of block.items) {
        parts.push(...item);
      }
    } else if (block.type === "table") {
      for (const header of block.headers) {
        parts.push(...header);
      }
      for (const row of block.rows) {
        for (const cell of row) {
          parts.push(...cell);
        }
      }
    } else if (block.type === "footnotes") {
      for (const item of block.items) {
        parts.push(...item.parts);
      }
    }
  }
  return flattenInlineParts(parts);
}

function flattenInlineParts(parts: readonly RichInlinePart[]): RichInlinePart[] {
  return parts.flatMap((part) => {
    if (part.type !== "strong" && part.type !== "emphasis" && part.type !== "strikethrough") {
      return [part];
    }
    return [part, ...flattenInlineParts(part.parts)];
  });
}

function codeFenceBlock(language: string | null, code: string): RichContentBlock {
  const normalizedLanguage = normalizeCodeLanguage(language);
  if (normalizedLanguage === "mermaid") {
    return {
      code: normalizeMermaidCode(code),
      type: "mermaid",
    };
  }
  return {
    code,
    language: normalizedLanguage,
    type: "code",
  };
}

function normalizeCodeLanguage(language: string | null): string | null {
  if (!language) {
    return null;
  }
  const normalized = language.trim().toLowerCase();
  return /^[a-z][a-z0-9#+.-]{0,31}$/.test(normalized) ? normalized : null;
}

function readFence(line: string): { fence: string; language: string | null } | null {
  const match = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)?.*$/.exec(line);
  if (!match) {
    return null;
  }
  return {
    fence: match[1] ?? "```",
    language: match[2] || null,
  };
}

function isClosingFence(line: string, fence: string): boolean {
  const trimmedLine = line.trimEnd();
  const indentationLength = trimmedLine.length - trimmedLine.trimStart().length;
  const fenceMarker = trimmedLine.slice(indentationLength);
  const fenceChar = fence.charAt(0);
  return (
    indentationLength <= 3 &&
    fenceMarker.length >= fence.length &&
    [...fenceMarker].every((char) => char === fenceChar)
  );
}

function readNextFenceMarker(line: string, currentFenceMarker: string | null): string | null {
  const fenceMatch = FENCE_MARKER_RE.exec(line);
  if (!fenceMatch) {
    return currentFenceMarker;
  }
  const marker = fenceMatch[1] ?? "";
  if (currentFenceMarker === null) {
    return marker;
  }
  const sameFenceChar = marker.startsWith(currentFenceMarker.charAt(0));
  return sameFenceChar && marker.length >= currentFenceMarker.length
    ? null
    : currentFenceMarker;
}

function isTableHeader(headerLine: string, dividerLine: string): boolean {
  const headers = splitTableRow(headerLine);
  const dividers = splitTableRow(dividerLine);
  if (headers.length < 2 || dividers.length !== headers.length) {
    return false;
  }
  return dividers.every(isTableDividerCell);
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  const start = trimmed[0] === "|" && !isEscapedMarkdownPunctuation(trimmed, 0) ? 1 : 0;
  const end =
    trimmed.at(-1) === "|" && !isEscapedMarkdownPunctuation(trimmed, trimmed.length - 1)
      ? trimmed.length - 1
      : trimmed.length;
  const cells: string[] = [];
  let cell = "";
  let inlineCodeDelimiterLength: number | null = null;
  let cursor = start;

  while (cursor < end) {
    const char = trimmed[cursor] ?? "";
    if (char === "`") {
      const runLength = consumeBacktickRun(trimmed, cursor);
      cell += trimmed.slice(cursor, cursor + runLength);
      if (inlineCodeDelimiterLength === null) {
        inlineCodeDelimiterLength = runLength;
      } else if (runLength === inlineCodeDelimiterLength) {
        inlineCodeDelimiterLength = null;
      }
      cursor += runLength;
      continue;
    }

    if (
      char === "|" &&
      inlineCodeDelimiterLength === null &&
      !isEscapedMarkdownPunctuation(trimmed, cursor)
    ) {
      cells.push(cell.trim());
      cell = "";
      cursor += 1;
      continue;
    }

    cell += char;
    cursor += 1;
  }

  cells.push(cell.trim());
  return cells;
}

function isTableDividerCell(cell: string): boolean {
  return /^:?-{3,}:?$/.test(cell);
}

function readTableDividerAlignment(cell: string): RichTableColumnAlignment {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) {
    return "center";
  }
  if (right) {
    return "right";
  }
  if (left) {
    return "left";
  }
  return null;
}

function normalizeTableRow(cells: string[], columnCount: number): string[] {
  if (cells.length >= columnCount) {
    return cells.slice(0, columnCount);
  }
  return [...cells, ...Array.from({ length: columnCount - cells.length }, () => "")];
}

function resolveLinkHref(href: string, context: RichContentContext): string {
  if (context.threadId && href.startsWith("/mnt/")) {
    return resolveMarkdownArtifactUrl(href, context.threadId);
  }
  return href;
}

function resolveImageSrc(src: string, context: RichContentContext): string {
  if (!context.threadId) {
    return src;
  }
  return resolveMessageMediaUrl({
    artifactPaths: context.artifactPaths ?? [],
    src,
    threadId: context.threadId,
  });
}
