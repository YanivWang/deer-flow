import type { CitationSource, RichContentBlock, RichInlinePart } from "./types";

export function collectCitationSources(blocks: readonly RichContentBlock[]): CitationSource[] {
  const seen = new Set<string>();
  const sources: CitationSource[] = [];
  for (const part of flattenBlockParts(blocks)) {
    if (part.type !== "link" || !part.citationLabel) continue;
    const key = `${part.citationLabel}\n${part.href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ href: part.href, label: part.citationLabel });
  }
  return sources;
}

function flattenBlockParts(blocks: readonly RichContentBlock[]): RichInlinePart[] {
  const parts: RichInlinePart[] = [];
  for (const block of blocks) {
    if (block.type === "paragraph" || block.type === "heading" || block.type === "blockquote") parts.push(...block.parts);
    else if (block.type === "list" || block.type === "ordered-list") parts.push(...block.items.flat());
    else if (block.type === "table") parts.push(...block.headers.flat(), ...block.rows.flat(2));
    else if (block.type === "footnotes") parts.push(...block.items.flatMap((item) => item.parts));
  }
  return flattenInlineParts(parts);
}

function flattenInlineParts(parts: readonly RichInlinePart[]): RichInlinePart[] {
  return parts.flatMap((part) => {
    if (part.type !== "strong" && part.type !== "emphasis" && part.type !== "strikethrough") return [part];
    return [part, ...flattenInlineParts(part.parts)];
  });
}
