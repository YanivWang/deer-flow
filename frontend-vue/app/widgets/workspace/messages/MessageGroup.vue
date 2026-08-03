<script setup lang="ts">
import type { StreamViewMessage } from "../../../core/stream/view-model";
import type { HumanInputRequest, HumanInputResponse } from "../../../core/messages/human-input";
import type { ToolRichCard } from "../../../core/messages/tool-cards";
import MessageListItem from "./MessageListItem.vue";

type MessageGroupRole = "human" | "ai" | "tool" | "error" | "unknown";
const props = defineProps<{
  artifactPaths?: readonly string[];
  canBranch: boolean;
  disabled?: boolean;
  displayIndex: number;
  duration: number | null;
  humanInputRequest: HumanInputRequest | null;
  isLastRunAssistant: boolean;
  isStreaming?: boolean;
  message: StreamViewMessage;
  messageElement: string | null;
  role: MessageGroupRole;
  rendererRole: "ai" | "tool" | "error" | "unknown";
  referenceCount: number;
  threadId?: string;
  toolCards: ToolRichCard[];
}>();

const emit = defineEmits<{
  selection: [message: StreamViewMessage];
  selectArtifact: [path: string];
  askSideChat: [message: StreamViewMessage, text: string, displayIndex: number];
  editMessage: [message: StreamViewMessage];
  regenerateMessage: [message: StreamViewMessage];
  branchConversation: [message: StreamViewMessage];
  submitHumanInput: [request: HumanInputRequest, response: HumanInputResponse];
}>();

function forwardAskSideChat(message: StreamViewMessage, text: string, displayIndex: number) {
  emit("askSideChat", message, text, displayIndex);
}

function forwardHumanInput(request: HumanInputRequest, response: HumanInputResponse) {
  emit("submitHumanInput", request, response);
}
</script>

<template>
  <MessageListItem
    v-bind="props"
    @selection="emit('selection', $event)"
    @select-artifact="emit('selectArtifact', $event)"
    @ask-side-chat="forwardAskSideChat"
    @edit-message="emit('editMessage', $event)"
    @regenerate-message="emit('regenerateMessage', $event)"
    @branch-conversation="emit('branchConversation', $event)"
    @submit-human-input="forwardHumanInput"
  />
</template>
