<script setup lang="ts">
import { computed, ref } from "vue";

import type { StreamViewMessage } from "../../../core/stream/view-model";
import type { HumanInputRequest, HumanInputResponse } from "../../../core/messages/human-input";
import { normalizeMessageRole, toMessageRenderEntry, type MessageGroupRole } from "../../../entities/message";
import MessageGroup from "./MessageGroup.vue";
import MessageSelectionToolbar from "./MessageSelectionToolbar.vue";

const props = defineProps<{
  artifactPaths?: readonly string[];
  disabled?: boolean;
  isStreaming?: boolean;
  messages: StreamViewMessage[];
  threadId?: string;
}>();

const emit = defineEmits<{
  selectArtifact: [path: string];
  askSideChat: [message: StreamViewMessage, selectedText: string, displayIndex: number];
  addConversationReference: [message: StreamViewMessage, selectedText: string, displayIndex: number];
  editMessage: [message: StreamViewMessage];
  regenerateMessage: [message: StreamViewMessage];
  branchConversation: [message: StreamViewMessage];
  submitHumanInput: [request: HumanInputRequest, response: HumanInputResponse];
}>();

const selectedMessageIndex = ref<number | null>(null);
const selectionText = ref("");

const renderedMessages = computed(() => props.messages.map(toMessageRenderEntry));

function groupRole(role: string): MessageGroupRole {
  return normalizeMessageRole(role);
}

function rendererRole(role: string): "ai" | "tool" | "error" | "unknown" {
  const group = groupRole(role);
  return group === "ai" || group === "tool" || group === "error" ? group : "unknown";
}

function handleSelection(message: StreamViewMessage) {
  const selection = window.getSelection()?.toString().trim();
  selectionText.value = selection ?? "";
  selectedMessageIndex.value = selection ? props.messages.indexOf(message) : null;
}

function selectionMessage(): StreamViewMessage | null {
  return selectedMessageIndex.value === null ? null : props.messages[selectedMessageIndex.value] ?? null;
}

function addSelectedReference() {
  const message = selectionMessage();
  if (!message || !selectionText.value) return;
  emit("addConversationReference", message, selectionText.value, (selectedMessageIndex.value ?? 0) + 1);
  selectedMessageIndex.value = null;
}

function askSelectedSideChat() {
  const message = selectionMessage();
  if (!message || !selectionText.value) return;
  emit("askSideChat", message, selectionText.value, (selectedMessageIndex.value ?? 0) + 1);
  selectedMessageIndex.value = null;
}

function forwardAskSideChat(message: StreamViewMessage, text: string, displayIndex: number) {
  emit("askSideChat", message, text, displayIndex);
}

function forwardHumanInput(request: HumanInputRequest, response: HumanInputResponse) {
  emit("submitHumanInput", request, response);
}

function referenceCount(message: StreamViewMessage): number {
  const raw = message.raw;
  const kwargs = raw && typeof raw === "object" ? Reflect.get(raw, "additional_kwargs") : null;
  const count = kwargs && typeof kwargs === "object" ? Reflect.get(kwargs, "referenced_message_count") : null;
  return typeof count === "number" ? count : 0;
}

function canBranchMessage(index: number): boolean {
  const entry = renderedMessages.value[index];
  if (!entry || groupRole(entry.message.role) !== "ai" || entry.toolCards.length > 0 || !entry.message.content.trim()) {
    return false;
  }
  for (const next of renderedMessages.value.slice(index + 1)) {
    const role = groupRole(next.message.role);
    if (role === "human") return true;
    if (next.toolCards.length > 0) return false;
  }
  return true;
}

function runIdOf(message: StreamViewMessage): string | null {
  const raw = message.raw;
  return raw && typeof raw === "object" && typeof Reflect.get(raw, "run_id") === "string"
    ? Reflect.get(raw, "run_id") as string
    : null;
}

function durationOf(message: StreamViewMessage): number | null {
  if (!message.raw || typeof message.raw !== "object") return null;
  const kwargs = Reflect.get(message.raw, "additional_kwargs");
  const duration = kwargs && typeof kwargs === "object" ? Reflect.get(kwargs, "turn_duration") : null;
  return typeof duration === "number" && Number.isFinite(duration) && duration >= 0 ? duration : null;
}

function messageElementOf(message: StreamViewMessage): string | null {
  if (!message.raw || typeof message.raw !== "object") return null;
  const additional = Reflect.get(message.raw, "additional_kwargs");
  if (!additional || typeof additional !== "object") return null;
  const element = Reflect.get(additional, "element");
  return typeof element === "string" ? element : null;
}

function durationForRun(index: number): number | null {
  const message = props.messages[index];
  if (!message) return null;
  const runId = runIdOf(message);
  if (!runId) return durationOf(message);
  for (const candidate of props.messages) {
    if (runIdOf(candidate) !== runId) continue;
    const duration = durationOf(candidate);
    if (duration !== null) return duration;
  }
  return null;
}

function isLastRunAssistant(index: number): boolean {
  const message = props.messages[index];
  if (!message) return true;
  const runId = runIdOf(message);
  if (!runId) return true;
  return !props.messages.slice(index + 1).some((message) => groupRole(message.role) === "ai" && runIdOf(message) === runId);
}

</script>

<template>
  <MessageSelectionToolbar
    v-if="selectedMessageIndex !== null && selectionText"
    :can-ask="groupRole(props.messages[selectedMessageIndex]?.role ?? '') === 'ai'"
    @add="addSelectedReference"
    @ask="askSelectedSideChat"
  />
  <MessageGroup
    v-for="({ message, humanInputRequest, toolCards }, index) in renderedMessages"
    :key="message.id || `${message.role}-${index}`"
    :artifact-paths="artifactPaths"
    :can-branch="canBranchMessage(index)"
    :disabled="disabled"
    :display-index="index + 1"
    :duration="durationForRun(index)"
    :human-input-request="humanInputRequest"
    :is-last-run-assistant="isLastRunAssistant(index)"
    :is-streaming="isStreaming"
    :message="message"
    :message-element="messageElementOf(message)"
    :renderer-role="rendererRole(message.role)"
    :reference-count="referenceCount(message)"
    :role="groupRole(message.role)"
    :thread-id="threadId"
    :tool-cards="toolCards"
    @selection="handleSelection"
    @select-artifact="emit('selectArtifact', $event)"
    @ask-side-chat="forwardAskSideChat"
    @edit-message="emit('editMessage', $event)"
    @regenerate-message="emit('regenerateMessage', $event)"
    @branch-conversation="emit('branchConversation', $event)"
    @submit-human-input="forwardHumanInput"
  />
</template>
