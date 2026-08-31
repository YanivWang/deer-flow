/*
  【文件职责】     纯匹配 workspace 全局快捷键与 editable target。
  【架构位置】     L3 workspace shell
  【主要导出】     commandForWorkspaceShortcut · isWorkspaceShortcutEditableTarget
                   · shortcutModifierLabels
  【依赖关系】     DOM KeyboardEvent
  【边界与注意】   拒绝 repeat/IME/Alt/冲突 modifier；listener 只在 CommandPalette 创建。

                   修饰键的**显示**形状也在这里，不写在模板里：上游 CommandPalette
                   按 `navigator.userAgent.includes("Mac")` 在 ⌘/⇧ 与 Ctrl+/Shift+
                   之间切换（frontend/src/components/workspace/command-palette.tsx）。
                   模板里写死 ⌘ 的话，Windows 与 Linux 用户会看到一串他们键盘上
                   没有的符号——而快捷键本身两边都已经认 Ctrl（见上面的
                   `metaKey !== ctrlKey`），只有标签在骗人。

                   放 .ts 而不是 .vue，还因为 i18n source guard 只扫产品 `.vue`：
                   "Ctrl+" 这种非标识符形状的字面量留在模板里会被当成未翻译文案。
                   它也确实不该进词典——它是键盘上印着的东西，不是界面文案，
                   上游同样没有翻译它。
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

/** 修饰键在界面上的写法。两套都不是文案，是键盘上印着的符号。 */
export type ShortcutModifierLabels = { meta: string; shift: string };

export const MAC_SHORTCUT_MODIFIERS: ShortcutModifierLabels = {
  meta: "\u2318",
  shift: "\u21e7",
};

export const OTHER_SHORTCUT_MODIFIERS: ShortcutModifierLabels = {
  meta: "Ctrl+",
  shift: "Shift+",
};

/**
 * 与上游同一条判据：user agent 里有没有 "Mac"。
 *
 * 调用方在挂载后才问，SSR 阶段用 {@link OTHER_SHORTCUT_MODIFIERS} —— 上游的
 * `useState(false)` 起点也是这一套，两边首帧一致，也不会有 hydration 不匹配。
 */
export function shortcutModifierLabels(
  userAgent: string | undefined,
): ShortcutModifierLabels {
  return userAgent?.includes("Mac")
    ? MAC_SHORTCUT_MODIFIERS
    : OTHER_SHORTCUT_MODIFIERS;
}
