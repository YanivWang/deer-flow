<script setup lang="ts">
import { MoreHorizontal, Pencil, Pin, PinOff, Share2, Trash2 } from "lucide-vue-next";
import type { AgentThread } from "../../../core/api/thread/types";
import type { useThreadList } from "../../../entities/thread/use-thread-list";
import type { ChatSidebarPaginationController } from "../../../features/chat/sidebar/use-chat-sidebar-pagination";
import AppDialog from "../../../shared/ui/AppDialog.vue";

type ThreadList = ReturnType<typeof useThreadList>;

const props = defineProps<{
  isLoading: boolean;
  threadActionErrorMessage: string | null;
  threadId: string;
  threadList: ThreadList;
  pagination: ChatSidebarPaginationController;
  threads: AgentThread[];
}>();

const emit = defineEmits<{
  deleteThread: [threadId: string];
  prepareThreadNavigation: [threadId: string];
  togglePinned: [threadId: string, pinned: boolean];
}>();

const sidebarMenuThreadId = ref<string | null>(null);
const renameDialogOpen = ref(false);
const renameThreadId = ref<string | null>(null);
const renameDraft = ref("");
const renameErrorMessage = ref<string | null>(null);
const shareMessage = ref<string | null>(null);
const { t } = useAppI18n();

function displayThreadTitle(thread: AgentThread): string {
  const title = props.threadList.titleOfThread(thread);
  return title === "Untitled" ? "New Chat" : title;
}

function closeThreadMenu(): void {
  sidebarMenuThreadId.value = null;
}

function openRenameDialog(thread: AgentThread): void {
  renameThreadId.value = thread.thread_id;
  renameDraft.value = displayThreadTitle(thread);
  renameErrorMessage.value = null;
  renameDialogOpen.value = true;
  closeThreadMenu();
}

function closeRenameDialog(): void {
  renameDialogOpen.value = false;
  renameThreadId.value = null;
  renameDraft.value = "";
  renameErrorMessage.value = null;
}

async function submitRename(): Promise<void> {
  const title = renameDraft.value.trim();
  if (!renameThreadId.value || !title) return;
  try {
    await props.threadList.renameThread({ threadId: renameThreadId.value, title });
    closeRenameDialog();
  } catch (error) {
    renameErrorMessage.value = error instanceof Error ? error.message : t("common.renameFailed");
  }
}

async function shareThread(thread: AgentThread): Promise<void> {
  const path = props.threadList.pathOfThread(thread);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  try {
    await navigator.clipboard.writeText(`${origin}${path}`);
    shareMessage.value = t("clipboard.linkCopied");
  } catch {
    shareMessage.value = t("clipboard.failedToCopyToClipboard");
  } finally {
    closeThreadMenu();
  }
}
</script>

<template>
  <a-spin v-if="props.isLoading" role="status" />
  <nav v-else class="workspace-sidebar__list" data-testid="vue-chat-thread-list">
    <h3 class="workspace-sidebar__recent-heading">{{ t("sidebar.recentChats") }}</h3>
    <a-alert v-if="props.threadActionErrorMessage" data-testid="vue-thread-action-error" role="alert" type="error" show-icon :message="props.threadActionErrorMessage" />
    <div v-for="thread in props.threads" :key="thread.thread_id" class="workspace-sidebar__item" data-sidebar="menu-item" :class="{ 'workspace-sidebar__item--active': thread.thread_id === props.threadId }" :data-testid="`vue-thread-list-item-${thread.thread_id}`">
      <NuxtLink class="workspace-sidebar__link" data-sidebar="menu-button" :to="props.threadList.pathOfThread(thread)" @click="emit('prepareThreadNavigation', thread.thread_id)">
        <span>{{ displayThreadTitle(thread) }}</span>
        <small class="workspace-thread-meta" :data-status="thread.status" v-bind="props.threadList.channelSourceOfThread(thread) ? { [(['aria', 'label'].join('-'))]: `${props.threadList.channelSourceOfThread(thread)?.label} channel` } : {}">
          <span v-if="props.threadList.channelSourceOfThread(thread)" class="workspace-thread-meta__channel">{{ props.threadList.channelSourceOfThread(thread)?.label }}</span>
        </small>
      </NuxtLink>
      <div class="workspace-sidebar__actions">
        <button
          class="workspace-sidebar__more"
          type="button"
          :data-testid="`vue-thread-more-${thread.thread_id}`"
          @click="sidebarMenuThreadId = sidebarMenuThreadId === thread.thread_id ? null : thread.thread_id"
        >
          <MoreHorizontal :size="16" aria-hidden="true" />
          <span>{{ t("common.more") }}</span>
        </button>
        <div v-if="sidebarMenuThreadId === thread.thread_id" class="workspace-sidebar__thread-menu" role="menu">
          <button
            role="menuitem"
            type="button"
            :disabled="props.threadList.isPinningThread.value"
            :data-testid="`vue-thread-pin-${thread.thread_id}`"
            @click="emit('togglePinned', thread.thread_id, props.threadList.isThreadPinned(thread)); closeThreadMenu()"
          >
            <PinOff v-if="props.threadList.isThreadPinned(thread)" :size="16" aria-hidden="true" />
            <Pin v-else :size="16" aria-hidden="true" />
            {{ props.threadList.isThreadPinned(thread) ? t("chats.unpinChat") : t("chats.pinChat") }}
          </button>
          <button
            role="menuitem"
            type="button"
            :data-testid="`vue-thread-rename-${thread.thread_id}`"
            @click="openRenameDialog(thread)"
          >
            <Pencil :size="16" aria-hidden="true" />
            {{ t("common.rename") }}
          </button>
          <button role="menuitem" type="button" @click="shareThread(thread)">
            <Share2 :size="16" aria-hidden="true" />
            {{ t("common.share") }}
          </button>
          <button
            role="menuitem"
            type="button"
            :disabled="props.threadList.isDeletingThread.value"
            :data-testid="`vue-thread-delete-${thread.thread_id}`"
            @click="emit('deleteThread', thread.thread_id); closeThreadMenu()"
          >
            <Trash2 :size="16" aria-hidden="true" />
            {{ t("common.delete") }}
          </button>
        </div>
      </div>
    </div>
    <p v-if="shareMessage" class="workspace-sidebar__share-status">{{ shareMessage }}</p>
    <a-button v-if="props.pagination.hasMoreThreads.value" :loading="props.pagination.isLoadingMoreThreads.value" data-testid="vue-thread-list-load-more" @click="() => { void props.pagination.loadMoreThreads().catch(() => undefined); }">{{ t("sidebar.loadOlderChats") }}</a-button>
    <div v-if="props.pagination.hasMoreThreads.value" :ref="props.pagination.setRecentChatSentinel" data-testid="recent-chat-list-sentinel" class="workspace-sidebar__sentinel" />
  </nav>
  <AppDialog
    :open="renameDialogOpen"
    :title="t('common.rename')"
    :close-label="t('common.close')"
    @close="closeRenameDialog"
  >
    <form class="workspace-sidebar__rename-dialog" @submit.prevent="submitRename">
      <p
        v-if="renameErrorMessage"
        class="workspace-sidebar__rename-error"
        data-testid="vue-thread-rename-error"
        role="alert"
      >
        {{ renameErrorMessage }}
      </p>
      <input
        v-model="renameDraft"
        class="workspace-sidebar__rename-input"
        :placeholder="t('common.rename')"
        data-testid="vue-thread-rename-input"
      >
      <div class="workspace-sidebar__rename-actions">
        <button type="button" @click="closeRenameDialog">{{ t("common.cancel") }}</button>
        <button
          type="submit"
          :disabled="!renameDraft.trim() || props.threadList.isRenamingThread.value"
          data-testid="vue-thread-rename-submit"
        >
          {{ t("common.rename") }}
        </button>
      </div>
    </form>
  </AppDialog>
</template>
