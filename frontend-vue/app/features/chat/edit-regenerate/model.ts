export function hasEditableMessageId(messageId: string | null): messageId is string {
  return Boolean(messageId);
}
