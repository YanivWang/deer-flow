/*
  【文件职责】     持有 settings dialog 的全局打开状态与目标分区。
  【架构位置】     L3 Vue adapter
  【主要导出】     useSettingsDialog · SettingsSection
  【依赖关系】     Vue refs · SettingsDialog · core/workspace-shell/settings-query
  【边界与注意】   DeerFlow 设置作用域，不进入 L2。

                   `SettingsSection` 只在这里**转出**，定义在
                   `core/workspace-shell/settings-query.ts`——分区清单与分区名
                   必须同源，理由写在那份文件的类型上方。这里保留导出是为了不动
                   既有 import 路径。
*/

import { ref } from "vue";

import type { SettingsSection } from "@/core/workspace-shell/settings-query";

export type { SettingsSection };

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
