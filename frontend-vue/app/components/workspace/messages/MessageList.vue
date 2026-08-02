<script setup lang="ts">
import { computed, ref } from "vue";

import type { StreamViewMessage } from "../../../core/api/stream/view-model";
import {
  extractHumanInputRequest,
  type HumanInputRequest,
  type HumanInputResponse,
} from "../../../core/messages/human-input";
import { extractToolRichCards } from "../../../core/messages/tool-cards";
import WorkspaceChangeBadge from "../changes/WorkspaceChangeBadge.vue";

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

const renderedMessages = computed(() =>
  props.messages.map((message) => ({
    message,
    humanInputRequest: extractHumanInputRequest(message.raw ?? message),
    toolCards: extractToolRichCards(message.raw ?? message),
  })),
);

type MessageGroupRole = "human" | "ai" | "tool" | "error" | "unknown";

function groupRole(role: string): MessageGroupRole {
  if (role === "human" || role === "user") {
    return "human";
  }
  if (role === "ai" || role === "assistant") {
    return "ai";
  }
  if (role === "tool") {
    return "tool";
  }
  if (role === "error") {
    return "error";
  }
  return "unknown";
}

function labelOfRole(role: string): string {
  const group = groupRole(role);
  if (group === "human") {
    return "用户";
  }
  if (group === "ai") {
    return "AI";
  }
  if (group === "tool") {
    return "工具";
  }
  if (group === "error") {
    return "错误";
  }
  return "消息";
}

function handleSelection(_message: StreamViewMessage, index: number) {
  const selection = window.getSelection()?.toString().trim();
  selectionText.value = selection ?? "";
  selectedMessageIndex.value = selection ? index : null;
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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining === 0 ? `${minutes}m` : `${minutes}m ${remaining}s`;
}

</script>

<template>
  <div
    v-if="selectedMessageIndex !== null && selectionText"
    class="message-list__selection-toolbar"
    data-sidecar-selection-toolbar
  >
    <button type="button" @click="addSelectedReference">Add to conversation</button>
    <button
      v-if="groupRole(props.messages[selectedMessageIndex]?.role ?? '') === 'ai'"
      type="button"
      @click="askSelectedSideChat"
    >Ask in side chat</button>
  </div>
  <article
    v-for="({ message, humanInputRequest, toolCards }, index) in renderedMessages"
    :key="message.id || `${message.role}-${index}`"
    class="message-list__item"
    :class="[
      `message-list__item--${groupRole(message.role)}`,
      { 'is-user': groupRole(message.role) === 'human' },
    ]"
    :data-assistant-turn="groupRole(message.role) === 'ai' ? 'true' : undefined"
    :data-role="groupRole(message.role)"
    :data-testid="`vue-message-${groupRole(message.role)}-${index}`"
    @mouseup="handleSelection(message, index)"
  >
    <strong class="message-list__role">{{ labelOfRole(message.role) }}</strong>
    <div v-if="toolCards.length > 0" class="message-list__tool-cards">
      <ToolRichCard
        v-for="card in toolCards"
        :key="`${card.kind}-${card.id ?? card.name}-${card.title}`"
        :card="card"
        @select-artifact="emit('selectArtifact', $event)"
      />
    </div>
    <div
      v-if="groupRole(message.role) === 'human'"
      class="message-list__content message-list__content--plain"
      data-testid="vue-message-plain-content"
    >
      {{ message.content }}
    </div>
    <div
      v-if="referenceCount(message) > 0"
      class="message-list__reference-attachment max-w-[min(18rem,100%)]"
      data-testid="message-reference-attachment"
    >
      {{ referenceCount(message) }} selected text fragment{{ referenceCount(message) === 1 ? "" : "s" }}
    </div>
    <section
      v-if="groupRole(message.role) === 'ai' && message.reasoning"
      class="message-list__reasoning"
      data-testid="vue-message-reasoning"
    >
      <button type="button" class="message-list__reasoning-trigger">
        {{ isStreaming ? "Thinking" : "Reasoning" }}
      </button>
      <p>{{ message.reasoning }}</p>
    </section>
    <RichMessageContent
      v-if="groupRole(message.role) !== 'human'"
      class="message-list__content"
      :artifact-paths="artifactPaths"
      :content="message.content"
      :streaming-reveal="isStreaming && groupRole(message.role) === 'ai'"
      :thread-id="threadId"
    />
    <div
      v-if="groupRole(message.role) === 'ai' && durationForRun(index) !== null && isLastRunAssistant(index)"
      class="message-list__run-duration"
      data-testid="run-duration"
    >
      Completed in {{ formatDuration(durationForRun(index) ?? 0) }}
    </div>
    <WorkspaceChangeBadge
      v-if="groupRole(message.role) === 'ai' && runIdOf(message) && isLastRunAssistant(index)"
      :thread-id="threadId ?? ''"
      :run-id="runIdOf(message) ?? ''"
    />
    <HumanInputCard
      v-if="humanInputRequest"
      :request="humanInputRequest"
      :disabled="disabled"
      @submit="emit('submitHumanInput', humanInputRequest, $event)"
    />
    <div v-if="groupRole(message.role) === 'ai'" class="message-list__actions">
      <button type="button" @click="emit('regenerateMessage', message)">Regenerate</button>
      <button
        v-if="canBranchMessage(index)"
        type="button"
        @click="emit('branchConversation', message)"
      >
        Branch conversation
      </button>
      <button
        type="button"
        @click="emit('askSideChat', message, message.content, index + 1)"
      >
        Ask in side chat
      </button>
    </div>
    <div v-if="groupRole(message.role) === 'human'" class="message-list__actions">
      <button type="button" @click="emit('editMessage', message)">Edit and rerun</button>
    </div>
  </article>
</template>
