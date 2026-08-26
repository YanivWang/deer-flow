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
  Download,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
      <!--
        绝对定位，压在会话行的右侧内边距上——这是 React 的 SidebarMenuAction
        （frontend/src/components/ui/sidebar.tsx），行本身用 `pr-8` 给它让位。
        原来它是同一行里的 flex 兄弟，于是链接被挤成 `flex-1`：会话标题量出来是
        「整行减去按钮」而不是文字本身，宽度、高度、颜色三项全落在 React 之外。
      -->
      <button
        type="button"
        :aria-label="$i18n.t.value.common.more"
        class="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 opacity-0 group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
      >
        <MoreHorizontal :size="16" />
      </button>
    </DropdownMenuTrigger>
    <!--
      顺序、分隔线位置和「导出」那一层子菜单都照 React 的 RecentChatList
      （frontend/src/components/workspace/recent-chat-list.tsx）：
      置顶 → 重命名 → 分享 → 导出(子菜单) → 分隔线 → 删除，**只有一条分隔线**。
      原来是「重命名 → 置顶 → 分隔线 → 分享 → 导出 md → 导出 json → 分隔线 → 删除」：
      顺序不同、多一条分隔线，而且把子菜单摊平成两个平级项——读屏器在 React 上听到
      的是「导出，子菜单」，在 Vue 上听到的是两个并列动作，菜单的形状根本不是一个。
      现有对照场景没有一条会点开这个菜单，所以台账一条都报不出来。
    -->
    <DropdownMenuContent align="end" class="min-w-48">
      <DropdownMenuItem @select="emit('togglePin')">
        <Pin :size="14" />
        {{
          pinned ? $i18n.t.value.chats.unpinChat : $i18n.t.value.chats.pinChat
        }}
      </DropdownMenuItem>
      <DropdownMenuItem @select="emit('rename')">
        <Pencil :size="14" /> {{ $i18n.t.value.common.rename }}
      </DropdownMenuItem>
      <DropdownMenuItem
        as="button"
        data-testid="thread-share"
        :disabled="sharing"
        @select="shareThread"
      >
        <Share2 :size="14" /> {{ $i18n.t.value.common.share }}
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Download :size="14" /> {{ $i18n.t.value.common.export }}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
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
        </DropdownMenuSubContent>
      </DropdownMenuSub>
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
