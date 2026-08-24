/*
  【文件职责】     决定 browser panel keydown 是否进入远端 wire，并保留宿主快捷键与 IME。
  【架构位置】     L3
  【主要导出】     decideBrowserKeyInput · FORWARDED_BROWSER_NAMED_KEYS
  【依赖关系】     browser/protocol.ts
  【边界与注意】   返回 null 时调用方不得 preventDefault；keyup 永不重复发送 press。
*/

import type { BrowserInputEvent } from "./protocol";

export const FORWARDED_BROWSER_NAMED_KEYS = [
  "Enter",
  "Backspace",
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Escape",
  "Delete",
] as const;

const HOST_SHORTCUT_KEYS = new Set([
  "l",
  "r",
  "t",
  "n",
  "w",
  "q",
  "m",
  "h",
  ",",
  " ",
  "`",
]);

export interface BrowserKeyContext {
  eventType: "keydown" | "keyup";
  live: boolean;
  editableTarget: boolean;
  composing: boolean;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export function decideBrowserKeyInput(
  context: BrowserKeyContext,
): BrowserInputEvent | null {
  if (
    context.eventType !== "keydown" ||
    !context.live ||
    context.editableTarget ||
    context.composing ||
    context.altKey
  ) {
    return null;
  }
  const modified = context.ctrlKey || context.metaKey;
  if (modified) {
    if (context.key.length !== 1) return null;
    if (HOST_SHORTCUT_KEYS.has(context.key.toLowerCase())) return null;
    const modifiers = [
      context.metaKey ? "Meta" : "Control",
      context.shiftKey ? "Shift" : null,
    ].filter(Boolean);
    return {
      type: "key",
      key: `${modifiers.join("+")}+${context.key.toUpperCase()}`,
    };
  }
  if (context.key.length === 1) {
    return { type: "text", text: context.key };
  }
  if (
    (FORWARDED_BROWSER_NAMED_KEYS as readonly string[]).includes(context.key)
  ) {
    return { type: "key", key: context.key };
  }
  return null;
}
