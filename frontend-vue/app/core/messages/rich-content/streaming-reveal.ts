import type { RichContentBlock, RichInlinePart } from "./types";

type BlockOf<TType extends RichContentBlock["type"]> = Extract<RichContentBlock, { type: TType }>;
type PartOf<TType extends RichInlinePart["type"]> = Extract<RichInlinePart, { type: TType }>;

export function applyStreamingReveal(
  blocks: readonly RichContentBlock[],
  previousBlocks: readonly RichContentBlock[],
): RichContentBlock[] {
  return blocks.map((block, index) => revealBlock(block, previousBlocks[index]));
}

function revealBlock(block: RichContentBlock, previousBlock: RichContentBlock | undefined): RichContentBlock {
  if (!previousBlock || previousBlock.type !== block.type) return markBlockReveal(block);
  if (block.type === "paragraph" || block.type === "heading" || block.type === "blockquote") {
    const previous = previousBlock as BlockOf<typeof block.type>;
    return { ...block, parts: revealInlineParts(block.parts, previous.parts) };
  }
  if (block.type === "list" || block.type === "ordered-list") {
    const previous = previousBlock as BlockOf<"list" | "ordered-list">;
    const items = block.items.map((item, index) => revealInlineParts(item, previous.items[index] ?? []));
    return {
      ...block,
      items,
      revealItems: items.map((item, index) => block.hiddenItems?.[index] ? false : item.some((part) => part.reveal) || (previous.hiddenItems?.[index] === true && item.length > 0)),
    };
  }
  if (block.type === "table") {
    const previous = previousBlock as BlockOf<"table">;
    return {
      ...block,
      headers: block.headers.map((header, index) => revealInlineParts(header, previous.headers[index] ?? [])),
      rows: block.rows.map((row, rowIndex) => row.map((cell, cellIndex) => revealInlineParts(cell, previous.rows[rowIndex]?.[cellIndex] ?? []))),
    };
  }
  if (block.type === "footnotes") {
    const previous = previousBlock as BlockOf<"footnotes">;
    return { ...block, items: block.items.map((item, index) => ({ ...item, parts: revealInlineParts(item.parts, previous.items[index]?.parts ?? []) })) };
  }
  if (block.type === "code" || block.type === "mermaid") {
    const previous = previousBlock as BlockOf<"code" | "mermaid">;
    return { ...block, reveal: block.code !== previous.code };
  }
  if (block.type === "math") {
    const previous = previousBlock as BlockOf<"math">;
    return { ...block, reveal: block.source !== previous.source };
  }
  return block;
}

function markBlockReveal(block: RichContentBlock): RichContentBlock {
  if (block.type === "paragraph" || block.type === "heading" || block.type === "blockquote") return { ...block, parts: block.parts.map(markInlinePartReveal) };
  if (block.type === "list" || block.type === "ordered-list") return { ...block, items: block.items.map((item) => item.map(markInlinePartReveal)) };
  if (block.type === "table") return { ...block, headers: block.headers.map((header) => header.map(markInlinePartReveal)), rows: block.rows.map((row) => row.map((cell) => cell.map(markInlinePartReveal))) };
  if (block.type === "footnotes") return { ...block, items: block.items.map((item) => ({ ...item, parts: item.parts.map(markInlinePartReveal) })) };
  return { ...block, reveal: true };
}

function revealInlineParts(parts: readonly RichInlinePart[], previousParts: readonly RichInlinePart[]): RichInlinePart[] {
  return parts.flatMap((part, index) => revealInlinePart(part, previousParts[index]));
}

function revealInlinePart(part: RichInlinePart, previousPart: RichInlinePart | undefined): RichInlinePart[] {
  if (!previousPart || previousPart.type !== part.type) return [markInlinePartReveal(part)];
  if (part.type === "text" || part.type === "code") return revealTextLikePart(part, (previousPart as PartOf<typeof part.type>).text);
  if (part.type === "line-break") return [part];
  if (part.type === "strong" || part.type === "emphasis" || part.type === "strikethrough") {
    const previous = previousPart as PartOf<typeof part.type>;
    const nested = revealInlineParts(part.parts, previous.parts);
    return nested.some((child) => child.reveal) ? [{ ...part, parts: nested, reveal: true }] : [part];
  }
  if (part.type === "unsafe-link") return part.label === (previousPart as PartOf<"unsafe-link">).label ? [part] : [{ ...part, reveal: true }];
  if (part.type === "link") {
    const previous = previousPart as PartOf<"link">;
    const same = part.href === previous.href && part.label === previous.label && part.citationLabel === previous.citationLabel;
    return same ? [part] : [{ ...part, reveal: true }];
  }
  if (part.type === "image") {
    const previous = previousPart as PartOf<"image">;
    return part.src === previous.src && part.alt === previous.alt ? [part] : [{ ...part, reveal: true }];
  }
  if (part.type === "html") return part.html === (previousPart as PartOf<"html">).html ? [part] : [{ ...part, reveal: true }];
  if (part.type === "footnote-ref") {
    const previous = previousPart as PartOf<"footnote-ref">;
    return part.label === previous.label && part.index === previous.index ? [part] : [{ ...part, reveal: true }];
  }
  return part.source === (previousPart as PartOf<"math">).source ? [part] : [{ ...part, reveal: true }];
}

function revealTextLikePart<TPart extends Extract<RichInlinePart, { text: string }>>(part: TPart, previousText: string): TPart[] {
  if (part.text === previousText) return [part];
  if (previousText && part.text.startsWith(previousText)) {
    const suffix = part.text.slice(previousText.length);
    return [{ ...part, text: previousText }, { ...part, reveal: true, text: suffix }].filter((item) => item.text.length > 0);
  }
  return [{ ...part, reveal: true }];
}

function markInlinePartReveal(part: RichInlinePart): RichInlinePart {
  if (part.type === "strong" || part.type === "emphasis" || part.type === "strikethrough") return { ...part, parts: part.parts.map(markInlinePartReveal), reveal: true };
  return { ...part, reveal: true };
}
