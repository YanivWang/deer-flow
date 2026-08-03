import type { BrowserInputEvent } from "./use-browser-stream";

const forwardedNamedKeys = new Set([
  "Enter",
  "Backspace",
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Escape",
  "Delete",
]);

export function decideBrowserKeyInput(context: {
  live: boolean;
  editableTarget: boolean;
  composing: boolean;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
}): BrowserInputEvent | null {
  if (!context.live || context.editableTarget || context.composing) return null;
  if ((context.ctrlKey || context.metaKey) && context.key.length === 1) {
    return {
      type: "key",
      key: `${context.metaKey ? "Meta" : "Control"}+${context.key.toUpperCase()}`,
    };
  }
  if (context.key.length === 1 && !context.metaKey && !context.ctrlKey) {
    return { type: "text", text: context.key };
  }
  if (forwardedNamedKeys.has(context.key)) {
    return { type: "key", key: context.key };
  }
  return null;
}
