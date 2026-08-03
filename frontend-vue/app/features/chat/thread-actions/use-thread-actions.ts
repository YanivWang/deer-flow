import { ref, type Ref } from "vue";

import type { HumanInputRequest, HumanInputResponse } from "../../../core/messages/human-input";
import { pathAfterDeletingThread } from "../../../core/api/thread/utils";
import { createThreadBranch, prepareThreadRun } from "../../../core/api/thread/client";
import type { DeerFlowMessage } from "../../../core/api/thread/types";
import { createId } from "../../../core/utils/id";
import type { StartThreadMessageOptions } from "../../../entities/thread/stream-store";
import { buildHumanInputSubmission } from "../answer-human-input/model";
import { hasEditableMessageId } from "../edit-regenerate/model";
import { normalizeThreadTitle } from "../rename-thread/model";
import { canStopChatRun } from "../stop-run/model";

type ThreadActionMessage = { id?: string; content?: unknown; role?: string };

type ThreadActionOptions = {
  agentName: Readonly<Ref<string | null>>;
  draft: Ref<string>;
  isBusy: Readonly<Ref<boolean>>;
  threadId: Readonly<Ref<string>>;
  threadRunContext: Readonly<Ref<Record<string, unknown> | undefined>>;
  activeThreadPinned: Readonly<Ref<boolean>>;
  createThread: (input: { agentName?: string | null; threadId?: string }) => Promise<{ thread_id: string }>;
  deleteThread: (input: { threadId: string }) => Promise<unknown>;
  pinThread: (input: { threadId: string; pinned: boolean }) => Promise<unknown>;
  renameThread: (input: { threadId: string; title: string }) => Promise<unknown>;
  pathOfThread: (threadId: string, context?: Record<string, unknown>) => string;
  sendMessage: (options: StartThreadMessageOptions) => Promise<void>;
  stop: (options?: { drain?: boolean }) => Promise<void>;
  refetchHistory: () => Promise<unknown>;
  refetchThreads: () => Promise<unknown>;
  resetStream: () => void;
  setHistoryMessages: (messages: DeerFlowMessage[]) => void;
  resetSidecar: () => void;
  pathOfNewThread: () => string;
  replaceRoute: (path: string) => Promise<void>;
  onNewChatStateReset: () => void;
  onBrowserClose: () => void;
};

export function useThreadActions(options: ThreadActionOptions) {
  const renameDraft = ref("");
  const renameErrorMessage = ref<string | null>(null);
  const editingMessageId = ref<string | null>(null);

  function resetForThreadNavigation() {
    options.resetStream();
    options.setHistoryMessages([]);
    options.resetSidecar();
  }

  async function goToNewChat() {
    resetForThreadNavigation();
    options.draft.value = "";
    editingMessageId.value = null;
    options.onNewChatStateReset();
    options.onBrowserClose();
    await options.replaceRoute(options.pathOfNewThread());
  }

  function prepareForThreadNavigation(nextThreadId: string) {
    if (nextThreadId === options.threadId.value) return;
    resetForThreadNavigation();
  }

  async function createNewThread() {
    try {
      const thread = await options.createThread({
        agentName: options.agentName.value,
        threadId: createId(),
      });
      await options.replaceRoute(options.pathOfThread(thread.thread_id, options.threadRunContext.value));
    } catch {
      // The mutation error is rendered through the sidebar action alert.
    }
  }

  async function renameActiveThread() {
    const title = normalizeThreadTitle(renameDraft.value);
    if (!title) return;
    try {
      await options.renameThread({ threadId: options.threadId.value, title });
      renameDraft.value = "";
      renameErrorMessage.value = null;
    } catch (error) {
      renameErrorMessage.value = error instanceof Error ? error.message : "重命名对话失败。";
    }
  }

  async function togglePinned(threadId: string, pinned: boolean) {
    await options.pinThread({ pinned: !pinned, threadId });
  }

  async function toggleActivePinned() {
    if (options.threadId.value === "new") return;
    await togglePinned(options.threadId.value, options.activeThreadPinned.value);
  }

  async function removeThread(threadIdToDelete: string) {
    await options.deleteThread({ threadId: threadIdToDelete });
    const nextPath = pathAfterDeletingThread({
      context: options.threadRunContext.value,
      createThreadId: createId,
      currentThreadId: options.threadId.value,
      deletedThreadId: threadIdToDelete,
    });
    if (nextPath) {
      resetForThreadNavigation();
      await options.replaceRoute(options.pathOfNewThread());
    }
  }

  function messageText(message: { content?: unknown }): string {
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object" && "text" in part) return String(part.text ?? "");
          return "";
        })
        .join("");
    }
    return "";
  }

  async function prepareRun(
    path: "/runs/regenerate/prepare" | "/runs/edit-regenerate/prepare",
    body: Record<string, unknown>,
  ) {
    return prepareThreadRun(options.threadId.value, path, body);
  }

  function replayOptions(prepared: Awaited<ReturnType<typeof prepareRun>>): StartThreadMessageOptions {
    return {
      checkpoint: prepared.checkpoint,
      context: {
        ...options.threadRunContext.value,
        agent_name: options.agentName.value ?? undefined,
        thread_id: options.threadId.value,
      },
      input: prepared.input,
      metadata: prepared.metadata,
      text: "replay",
      threadId: options.threadId.value,
    };
  }

  async function regenerateMessage(message: ThreadActionMessage) {
    if (!message.id || options.isBusy.value) return;
    const prepared = await prepareRun("/runs/regenerate/prepare", { message_id: message.id });
    await options.sendMessage(replayOptions(prepared));
    await options.refetchHistory();
  }

  async function branchConversation(message: ThreadActionMessage) {
    if (!message.id || options.isBusy.value) return;
    const result = await createThreadBranch(options.threadId.value, message.id);
    if (result.thread_id) await options.replaceRoute(`/workspace/chats/${result.thread_id}`);
  }

  function editMessage(message: ThreadActionMessage) {
    editingMessageId.value = message.id ?? null;
    options.draft.value = messageText(message);
  }

  function cancelEdit() {
    editingMessageId.value = null;
  }

  async function updateAndRerunMessage() {
    const messageId = editingMessageId.value;
    const replacementText = options.draft.value.trim();
    if (!hasEditableMessageId(messageId) || !replacementText || options.isBusy.value) return;
    const prepared = await prepareRun("/runs/edit-regenerate/prepare", {
      human_message_id: messageId,
      replacement_text: replacementText,
    });
    editingMessageId.value = null;
    options.draft.value = "";
    await options.sendMessage(replayOptions(prepared));
    await options.refetchHistory();
  }

  async function submitHumanInput(request: HumanInputRequest, response: HumanInputResponse) {
    if (options.isBusy.value) return false;
    const context = options.threadRunContext.value;
    const submission = buildHumanInputSubmission(request, response);
    await options.sendMessage({
      ...(context ? { context } : {}),
      additionalKwargs: submission.additionalKwargs,
      text: submission.text,
      threadId: options.threadId.value,
    });
    await options.refetchThreads();
    return true;
  }

  async function stopStream() {
    await options.stop({ drain: canStopChatRun(options.isBusy.value) });
    await options.refetchHistory();
    await options.refetchThreads();
  }

  return {
    cancelEdit,
    createNewThread,
    editingMessageId,
    goToNewChat,
    prepareForThreadNavigation,
    regenerateMessage,
    removeThread,
    renameActiveThread,
    renameDraft,
    renameErrorMessage,
    stopStream,
    submitHumanInput,
    toggleActivePinned,
    togglePinned,
    updateAndRerunMessage,
    editMessage,
    branchConversation,
  };
}
