/*
  【文件职责】     纯匹配 workspace 全局快捷键与 editable target。
  【对应 frontend/】 frontend/src/hooks/use-global-shortcuts.ts
  【架构位置】     L3 workspace shell
  【主要导出】     commandForWorkspaceShortcut · isWorkspaceShortcutEditableTarget
  【依赖关系】     DOM KeyboardEvent
  【边界与注意】   拒绝 repeat/IME/Alt/冲突 modifier；listener 只在 CommandPalette 创建。
*/
export type WorkspaceShortcutCommand =
  "command-palette" | "new-chat" | "settings" | "shortcuts" | "toggle-sidebar";

export type WorkspaceShortcutEvent = Pick<
  KeyboardEvent,
  | "key"
  | "metaKey"
  | "ctrlKey"
  | "shiftKey"
  | "altKey"
  | "repeat"
  | "isComposing"
>;

export function isWorkspaceShortcutEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return true;
  return Boolean(
    target.closest('[contenteditable]:not([contenteditable="false"])'),
  );
}

export function commandForWorkspaceShortcut(
  event: Partial<WorkspaceShortcutEvent> & Pick<WorkspaceShortcutEvent, "key">,
): WorkspaceShortcutCommand | null {
  if (event.repeat || event.isComposing || event.altKey) return null;
  const commandModifier = Boolean(event.metaKey) !== Boolean(event.ctrlKey);
  if (!commandModifier) return null;
  const key = event.key.toLowerCase();

  if (key === "n" && event.shiftKey) return "new-chat";
  if (event.shiftKey) return null;
  if (key === "k") return "command-palette";
  if (key === ",") return "settings";
  if (key === "/") return "shortcuts";
  if (key === "b") return "toggle-sidebar";
  return null;
}
