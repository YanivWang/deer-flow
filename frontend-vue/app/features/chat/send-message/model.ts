export function composeChatMessage(text: string, selectedSkill: string | null): string {
  const trimmed = text.trim();
  return selectedSkill ? `/${selectedSkill} ${trimmed}` : trimmed;
}

export function goalObjectiveFromMessage(text: string): string {
  return text.startsWith("/goal ") ? text.slice("/goal ".length).trim() : "";
}
