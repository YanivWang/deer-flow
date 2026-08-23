/*
  【文件职责】     持有 settings dialog 的全局打开状态与目标分区。
  【对应 frontend/】 src/components/workspace/settings/context.tsx
  【架构位置】     L3 Vue adapter
  【主要导出】     useSettingsDialog
  【依赖关系】     Vue refs · SettingsDialog
  【边界与注意】   DeerFlow 设置作用域，不进入 L2。
*/

import { ref } from "vue";

export type SettingsSection =
  | "account"
  | "appearance"
  | "notification"
  | "tools"
  | "skills"
  | "memory"
  | "integrations"
  | "channels"
  | "about";

const open = ref(false);
const section = ref<SettingsSection>("account");
const returnFocus = ref<HTMLElement | null>(null);

export function useSettingsDialog() {
  function show(
    next: SettingsSection = "account",
    options?: { returnFocus?: HTMLElement | null },
  ) {
    returnFocus.value = options?.returnFocus ?? null;
    section.value = next;
    open.value = true;
  }

  function close(_options?: { source?: "user" | "route" }) {
    open.value = false;
  }

  return { open, section, returnFocus, show, close };
}
