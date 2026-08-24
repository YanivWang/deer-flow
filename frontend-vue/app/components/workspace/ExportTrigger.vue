<script setup lang="ts">
/*
  【文件职责】     导出当前可见会话为 Markdown 或 JSON。
  【对应 frontend/】 src/components/workspace/export-trigger.tsx
  【架构位置】     L3 workspace chat header
  【主要导出】     默认 ExportTrigger 组件
  【依赖关系】     Reka DropdownMenu · core/threads/export · workspace toast
  【边界与注意】   只消费父层已拥有的 thread/messages，不另建请求或消息缓存。
*/
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "reka-ui";
import { Download, FileJson, FileText } from "lucide-vue-next";

import { exportThread, type ThreadExportFormat } from "@/core/threads/export";
import type { AgentThread } from "@/core/threads/types";
import type { Message } from "@/core/types/message";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const props = defineProps<{
  threadId: string;
  thread: AgentThread;
  messages: Message[];
}>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();

function exportConversation(format: ThreadExportFormat) {
  if (!props.messages.length) return;
  try {
    exportThread(props.thread, props.messages, format);
    toast.success($i18n.t.value.common.exportSuccess);
  } catch {
    toast.error($i18n.t.value.common.exportFailed);
  }
}
</script>

<template>
  <DropdownMenuRoot v-if="messages.length">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        :aria-label="$i18n.t.value.common.export"
        class="text-muted-foreground hover:text-foreground hover:bg-accent flex h-8 items-center gap-2 rounded-md px-2 text-sm"
      >
        <Download :size="16" />
        <span class="hidden sm:inline">{{ $i18n.t.value.common.export }}</span>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="4"
        class="bg-popover text-popover-foreground border-border z-[75] min-w-48 rounded-md border p-1 text-sm shadow-lg"
      >
        <DropdownMenuItem
          as="button"
          data-testid="header-export-markdown"
          class="hover:bg-accent focus:bg-accent flex w-full cursor-default items-center gap-2 rounded px-2 py-1.5 outline-none"
          @select="exportConversation('markdown')"
        >
          <FileText :size="16" class="text-muted-foreground" />
          {{ $i18n.t.value.common.exportAsMarkdown }}
        </DropdownMenuItem>
        <DropdownMenuItem
          as="button"
          data-testid="header-export-json"
          class="hover:bg-accent focus:bg-accent flex w-full cursor-default items-center gap-2 rounded px-2 py-1.5 outline-none"
          @select="exportConversation('json')"
        >
          <FileJson :size="16" class="text-muted-foreground" />
          {{ $i18n.t.value.common.exportAsJSON }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
