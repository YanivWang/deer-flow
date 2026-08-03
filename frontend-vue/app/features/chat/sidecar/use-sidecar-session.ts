import { computed, nextTick, ref, watch, type ComputedRef } from "vue";

import {
  createSidecarThread,
  deleteSidecarThread as deleteSidecarThreadRequest,
  getSidecarMessages,
  runSidecar,
} from "../../../core/api/sidecar/client";

import {
  buildSidecarContextPrompt,
  normalizeSidecarMessages,
  sidecarRunRequest,
  sidecarThreadMetadata,
  type SidecarMessage,
  type SidecarParentMessage,
  type SidecarReference,
  type SidecarThread,
} from "./model";

export function useSidecarSession({
  parentMessages,
  refreshThreads,
  restoredSidecarThread,
  threadId,
  threadRunContext,
}: {
  parentMessages: ComputedRef<SidecarParentMessage[]>;
  refreshThreads: () => Promise<unknown>;
  restoredSidecarThread: ComputedRef<SidecarThread | undefined>;
  threadId: ComputedRef<string>;
  threadRunContext: ComputedRef<Record<string, unknown> | undefined>;
}) {
  const sidecarOpen = ref(false);
  const sidecarThreadId = ref<string | null>(null);
  const sidecarMessages = ref<SidecarMessage[]>([]);
  const sidecarDraft = ref("");
  const sidecarModel = ref("DeepSeek V4 Pro");
  const sidecarMode = ref("Pro");
  const sidecarModeMenuOpen = ref(false);
  const sidecarModelMenuOpen = ref(false);
  const sidecarDeleteOpen = ref(false);
  const sidecarDeleting = ref(false);
  const sidecarSelectionText = ref("");
  const sidecarSelectionMessageId = ref<string | undefined>();
  const sidecarReferences = ref<SidecarReference[]>([]);

  const hasSidecarConversation = computed(() => Boolean(
    sidecarThreadId.value || restoredSidecarThread.value,
  ));

  watch(
    restoredSidecarThread,
    (thread) => {
      if (thread && !sidecarThreadId.value) {
        sidecarThreadId.value = thread.thread_id;
      }
    },
    { immediate: true },
  );

  watch(sidecarThreadId, (id) => {
    if (id) void loadSidecarMessages(id);
  });

  watch(threadId, (nextThreadId, previousThreadId) => {
    if (nextThreadId === previousThreadId) return;
    resetForParentThreadChange();
  });

  async function loadSidecarMessages(id: string) {
    try {
      sidecarMessages.value = normalizeSidecarMessages(await getSidecarMessages(id));
      await nextTick();
      await nextTick();
    } catch {
      sidecarMessages.value = [];
    }
  }

  async function toggleSidecar() {
    if (!sidecarOpen.value && sidecarThreadId.value) {
      await refreshThreads();
      if (!restoredSidecarThread.value) {
        resetDeletedSidecar();
        return;
      }
    }
    sidecarOpen.value = !sidecarOpen.value;
    if (sidecarOpen.value) {
      await nextTick();
    }
  }

  function askInSideChat(
    message: { content?: string; id?: string; role?: string },
    selectedText = "",
    displayIndex = 1,
  ) {
    sidecarReferences.value = [...sidecarReferences.value, {
      label: `Selected ${message.role === "human" || message.role === "user" ? "user" : "assistant"} text #${displayIndex}`,
      ...(message.id ? { messageId: message.id } : {}),
      role: message.role === "human" || message.role === "user" ? "user" : "assistant",
      content: selectedText || message.content || "",
    }];
    sidecarOpen.value = true;
  }

  function handleSidecarSelection(message: { id?: string }) {
    sidecarSelectionText.value = window.getSelection()?.toString().trim() ?? "";
    sidecarSelectionMessageId.value = message.id;
  }

  function addSelectedReference() {
    if (!sidecarSelectionText.value) return;
    sidecarReferences.value = [...sidecarReferences.value, {
      label: `Selected assistant text #${sidecarReferences.value.length + 1}`,
      ...(sidecarSelectionMessageId.value ? { messageId: sidecarSelectionMessageId.value } : {}),
      role: "assistant",
      content: sidecarSelectionText.value,
    }];
    sidecarSelectionText.value = "";
    sidecarSelectionMessageId.value = undefined;
  }

  function clearReferences() {
    sidecarReferences.value = [];
  }

  async function submitSidecarMessage() {
    const text = sidecarDraft.value.trim();
    if (!text || sidecarDeleting.value) return;
    let id = sidecarThreadId.value ?? restoredSidecarThread.value?.thread_id ?? null;
    if (!id) {
      const created = await createSidecarThread(sidecarThreadMetadata(threadId.value, sidecarReferences.value));
      id = created.thread_id ?? null;
      sidecarThreadId.value = id;
    }
    if (!id) return;

    const contextPrompt = buildSidecarContextPrompt(parentMessages.value, sidecarReferences.value);
    const body = sidecarRunRequest({
      context: threadRunContext.value,
      mode: sidecarMode.value,
      model: sidecarModel.value,
      parentThreadId: threadId.value,
      prompt: contextPrompt,
      references: sidecarReferences.value,
      text,
      threadId: id,
    });
    const response = await runSidecar(id, body);
    if (response.ok) {
      sidecarMessages.value = [
        ...sidecarMessages.value,
        { role: "human", content: text },
        { role: "ai", id: `msg-ai-sidecar-${sidecarMessages.value.length}`, content: "Hello from DeerFlow!" },
      ];
    }
    sidecarDraft.value = "";
    clearReferences();
  }

  async function deleteSidecarThread() {
    const id = sidecarThreadId.value ?? restoredSidecarThread.value?.thread_id;
    if (!id) {
      sidecarOpen.value = false;
      return;
    }
    sidecarDeleting.value = true;
    try {
      await deleteSidecarThreadRequest(id);
      resetDeletedSidecar();
      await refreshThreads();
    } finally {
      sidecarDeleting.value = false;
    }
  }

  function resetDeletedSidecar() {
    sidecarThreadId.value = null;
    sidecarMessages.value = [];
    sidecarOpen.value = false;
    sidecarDeleteOpen.value = false;
  }

  function resetForParentThreadChange() {
    sidecarOpen.value = false;
    sidecarThreadId.value = null;
    sidecarMessages.value = [];
    sidecarDraft.value = "";
    sidecarReferences.value = [];
    sidecarDeleteOpen.value = false;
  }

  return {
    addSelectedReference,
    askInSideChat,
    clearReferences,
    handleSidecarSelection,
    hasSidecarConversation,
    loadSidecarMessages,
    resetForParentThreadChange,
    sidecarDeleteOpen,
    sidecarDeleting,
    sidecarDraft,
    sidecarMessages,
    sidecarMode,
    sidecarModeMenuOpen,
    sidecarModel,
    sidecarModelMenuOpen,
    sidecarOpen,
    sidecarReferences,
    sidecarSelectionMessageId,
    sidecarSelectionText,
    sidecarThreadId,
    submitSidecarMessage,
    toggleSidecar,
    deleteSidecarThread,
  };
}
