import type { MemoryFact } from "./types";

// Shorten a fact for places that show it inline: the delete confirmation, and
// the accessible names of the per-row action buttons.
export function truncateFactPreview(content: string, maxLength = 140) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  const ellipsis = "...";
  if (maxLength <= ellipsis.length) {
    return normalized.slice(0, maxLength);
  }
  return `${normalized.slice(0, maxLength - ellipsis.length)}${ellipsis}`;
}

// Name the row each icon button acts on. A page of facts otherwise carries
// three identical "Edit" buttons and three identical "Delete" buttons, so a
// screen reader announces the same name for controls with different effects
// (WCAG 2.4.6). Reuse the preview truncation so one long fact cannot turn the
// accessible name into a paragraph.
export function factActionLabel(
  action: string,
  fact: Pick<MemoryFact, "content">,
) {
  return `${action}: ${truncateFactPreview(fact.content)}`;
}
