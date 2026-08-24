<script setup lang="ts">
/*
  【文件职责】     渲染 workspace 唯一的可访问 toast viewport。
  【架构位置】     L3 workspace shell
  【主要导出】     默认 WorkspaceToaster 组件
  【依赖关系】     workspace-shell/toast · i18n
  【边界与注意】   只渲染注入 owner，不创建第二份 toast store。
*/
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const toast = useWorkspaceToast();
</script>

<template>
  <ol
    data-testid="workspace-toaster"
    class="pointer-events-none fixed inset-x-0 top-3 z-[120] mx-auto flex w-[min(92vw,420px)] flex-col gap-2"
    :aria-label="$i18n.t.value.settings.notification.title"
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
</template>
