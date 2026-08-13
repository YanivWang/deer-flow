export type ImeKeyboardEvent = Pick<KeyboardEvent, "isComposing" | "keyCode">;

/** Safari can report keyCode 229 after composition state changes. */
export function isImeComposing(
  event: ImeKeyboardEvent,
  compositionActive = false,
): boolean {
  return compositionActive || event.isComposing || event.keyCode === 229;
}
