<script setup lang="ts">
/*
  【文件职责】     渲染 workspace 唯一的可访问 toast viewport。
  【架构位置】     L3 workspace shell
  【主要导出】     默认 WorkspaceToaster 组件
  【依赖关系】     workspace-shell/toast · i18n
  【边界与注意】   只渲染注入 owner，不创建第二份 toast store。

                   结构照 React 用的 sonner：外层是一个**常驻**的 section（role=region），
                   带 aria-live="polite"，里面的 ol 只在真有 toast 时才存在。
                   两层各有分工——常驻的那层让读屏器提前把 live region 挂上，新 toast
                   插进来才会被播报；空 ol 若长期挂在树里，读屏器每次遍历都会念出一个
                   永远是空的「通知列表」。

                   可访问名里的 `alt+T` 不是装饰：sonner 真的绑了这个热键，把焦点送进
                   toast 列表。名字承诺了热键，热键就必须存在，否则这句提示是假的。
                   Escape 在焦点位于列表内时把焦点交还——与 sonner 收起展开态同一个位置。
*/
import { onMounted, onUnmounted, ref } from "vue";

import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const toast = useWorkspaceToast();
const list = ref<HTMLOListElement | null>(null);

/** sonner 的默认热键：altKey + KeyT，可访问名里的 `alt+T` 就是它。 */
function onKeydown(event: KeyboardEvent) {
  if (event.altKey && event.code === "KeyT") {
    list.value?.focus();
    return;
  }
  if (
    event.code === "Escape" &&
    list.value &&
    (document.activeElement === list.value ||
      list.value.contains(document.activeElement))
  ) {
    (document.activeElement as HTMLElement | null)?.blur();
  }
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <section
    :aria-label="$i18n.t.value.primitives.notifications"
    tabindex="-1"
    aria-live="polite"
    aria-relevant="additions text"
    aria-atomic="false"
  >
    <ol
      v-if="toast.toasts.value.length"
      ref="list"
      data-testid="workspace-toaster"
      tabindex="-1"
      class="pointer-events-none fixed inset-x-0 top-3 z-[120] mx-auto flex w-[min(92vw,420px)] flex-col gap-2"
    >
      <li
        v-for="item in toast.toasts.value"
        :key="item.id"
        :role="item.kind === 'error' ? 'alert' : 'status'"
        :aria-live="item.kind === 'error' ? 'assertive' : 'polite'"
        class="bg-popover text-popover-foreground border-border pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg"
        :class="item.kind === 'error' ? 'border-destructive/40' : ''"
      >
        <span class="min-w-0 flex-1">{{ item.message }}</span>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground -m-1 rounded p-1"
          :aria-label="$i18n.t.value.workspace.dismissNotification"
          @click="toast.dismiss(item.id)"
        >
          ×
        </button>
      </li>
    </ol>
  </section>
</template>
