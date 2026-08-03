<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import type { StreamViewMessage } from "../../../core/stream/view-model";
import type { HumanInputRequest, HumanInputResponse } from "../../../core/messages/human-input";
import MessageList from "./MessageList.vue";

const props = defineProps<{
  artifactPaths: readonly string[];
  disabled: boolean;
  historyHasMore: boolean;
  historyIsLoading: boolean;
  isStreaming: boolean;
  messages: StreamViewMessage[];
  onHistorySentinel: (element: unknown) => void;
  threadId: string;
}>();

const messagesViewport = ref<HTMLElement | null>(null);
const shouldStickToBottom = ref(true);

function isNearBottom(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 96;
}

function handleMessagesScroll(): void {
  if (messagesViewport.value) {
    shouldStickToBottom.value = isNearBottom(messagesViewport.value);
  }
}

function scrollToBottom(): void {
  void nextTick(() => {
    const element = messagesViewport.value;
    if (!element || !shouldStickToBottom.value) return;
    element.scrollTop = element.scrollHeight;
  });
}

watch(
  () => [props.messages.length, props.isStreaming],
  () => scrollToBottom(),
);

onMounted(() => {
  messagesViewport.value?.addEventListener("scroll", handleMessagesScroll, { passive: true });
  scrollToBottom();
});

onBeforeUnmount(() => {
  messagesViewport.value?.removeEventListener("scroll", handleMessagesScroll);
});

const emit = defineEmits<{
  addConversationReference: [message: StreamViewMessage, selectedText: string, displayIndex: number];
  askSideChat: [message: StreamViewMessage, selectedText: string, displayIndex: number];
  branchConversation: [message: StreamViewMessage];
  editMessage: [message: StreamViewMessage];
  loadMoreHistory: [];
  regenerateMessage: [message: StreamViewMessage];
  selectArtifact: [path: string];
  submitHumanInput: [request: HumanInputRequest, response: HumanInputResponse];
}>();

const { t } = useAppI18n();

function addConversationReference(
  message: StreamViewMessage,
  selectedText: string,
  displayIndex: number,
): void {
  emit("addConversationReference", message, selectedText, displayIndex);
}

function askSideChat(
  message: StreamViewMessage,
  selectedText: string,
  displayIndex: number,
): void {
  emit("askSideChat", message, selectedText, displayIndex);
}

function submitHumanInput(request: HumanInputRequest, response: HumanInputResponse): void {
  emit("submitHumanInput", request, response);
}
</script>

<template>
  <section
    ref="messagesViewport"
    class="workspace-chat__messages"
    data-testid="vue-thread-stream-messages"
    role="log"
    aria-live="polite"
  >
    <div v-if="historyHasMore" :ref="onHistorySentinel">
      <a-button :loading="historyIsLoading" @click="emit('loadMoreHistory')">
        {{ t("common.loadMore") }}
      </a-button>
    </div>
    <MessageList
      :artifact-paths="artifactPaths"
      :disabled="disabled"
      :is-streaming="isStreaming"
      :messages="messages"
      :thread-id="threadId"
      @submit-human-input="submitHumanInput"
      @ask-side-chat="askSideChat"
      @edit-message="emit('editMessage', $event)"
      @regenerate-message="emit('regenerateMessage', $event)"
      @branch-conversation="emit('branchConversation', $event)"
      @select-artifact="emit('selectArtifact', $event)"
      @add-conversation-reference="addConversationReference"
    />
  </section>
</template>
