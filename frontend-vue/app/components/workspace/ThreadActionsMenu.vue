<script setup lang="ts">
/*
  【文件职责】     单个 recent thread 的 rename/pin/share/export/delete menu owner。
  【架构位置】     L3 workspace navigation
  【主要导出】     默认 ThreadActionsMenu 组件
  【依赖关系】     ui/dropdown-menu · thread API/export · clipboard · toast
  【边界与注意】   不复制 thread list；export 临时状态仅属于这一菜单实例。
*/
import { ref } from "vue";
import {
  FileJson,
  FileText,
  MoreHorizontal,
  Pencil,
  Pin,
  Share2,
  Trash2,
} from "lucide-vue-next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAPIClient } from "@/core/api/api-client";
import { writeTextToClipboard } from "@/core/clipboard";
import { exportThread, type ThreadExportFormat } from "@/core/threads/export";
import {
  buildThreadShareUrl,
  loadThreadExportMessages,
} from "@/core/threads/thread-actions";
import type { AgentThread } from "@/core/threads/types";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const props = defineProps<{
  thread: AgentThread;
  pinned: boolean;
  deleting?: boolean;
}>();
const emit = defineEmits<{
  rename: [];
  togglePin: [];
  delete: [];
}>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const exporting = ref<ThreadExportFormat | null>(null);
const sharing = ref(false);

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

async function shareThread() {
  if (sharing.value) return;
  sharing.value = true;
  try {
    const url = buildThreadShareUrl(props.thread, globalThis.location.origin);
    const copied = await writeTextToClipboard(url);
    if (!copied) {
      throw new Error($i18n.t.value.clipboard.failedToCopyToClipboard);
    }
    toast.success($i18n.t.value.clipboard.linkCopied);
  } catch (error) {
    toast.error(messageOf(error, $i18n.t.value.chats.shareFailed));
  } finally {
    sharing.value = false;
  }
}

async function exportConversation(format: ThreadExportFormat) {
  if (exporting.value) return;
  exporting.value = format;
  try {
    const messages = await loadThreadExportMessages(
      getAPIClient(),
      props.thread.thread_id,
    );
    exportThread(props.thread, messages, format);
    toast.success($i18n.t.value.common.exportSuccess);
  } catch (error) {
    const message = messageOf(error, $i18n.t.value.common.exportFailed);
    toast.error(
      /no messages to export/i.test(message)
        ? $i18n.t.value.chats.noMessagesToExport
        : message,
    );
  } finally {
    exporting.value = null;
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger>
      <button
        type="button"
        :aria-label="$i18n.t.value.common.more"
        class="mr-1 rounded px-2 py-1 opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
      >
        <MoreHorizontal :size="16" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-48">
      <DropdownMenuItem @select="emit('rename')">
        <Pencil :size="14" /> {{ $i18n.t.value.common.rename }}
      </DropdownMenuItem>
      <DropdownMenuItem @select="emit('togglePin')">
        <Pin :size="14" />
        {{
          pinned ? $i18n.t.value.chats.unpinChat : $i18n.t.value.chats.pinChat
        }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        as="button"
        data-testid="thread-share"
        :disabled="sharing"
        @select="shareThread"
      >
        <Share2 :size="14" /> {{ $i18n.t.value.common.share }}
      </DropdownMenuItem>
      <DropdownMenuItem
        as="button"
        data-testid="thread-export-markdown"
        :disabled="Boolean(exporting)"
        @select="exportConversation('markdown')"
      >
        <FileText :size="14" />
        {{ $i18n.t.value.common.exportAsMarkdown }}
      </DropdownMenuItem>
      <DropdownMenuItem
        as="button"
        data-testid="thread-export-json"
        :disabled="Boolean(exporting)"
        @select="exportConversation('json')"
      >
        <FileJson :size="14" /> {{ $i18n.t.value.common.exportAsJSON }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        as="button"
        variant="destructive"
        :disabled="deleting"
        @select="emit('delete')"
      >
        <Trash2 :size="14" /> {{ $i18n.t.value.common.delete }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
