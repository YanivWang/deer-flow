<script setup lang="ts">
import { computed } from "vue";

import type { StreamViewMessage } from "../../../core/stream/view-model";
import type { HumanInputRequest, HumanInputResponse } from "../../../core/messages/human-input";
import type { ToolRichCard } from "../../../core/messages/tool-cards";
import HumanInputCard from "./HumanInputCard.vue";
import MessageActions from "./MessageActions.vue";
import MessageContentRenderer from "./MessageContentRenderer.vue";
import MessageReasoning from "./MessageReasoning.vue";
import MessageRunMeta from "./MessageRunMeta.vue";
import MessageToolCards from "./MessageToolCards.vue";
import WorkspaceChangeBadge from "./WorkspaceChangeBadge.vue";

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

const tokenUsage = computed(() => readTokenUsage(props.message.raw));

function handleSelection() {
  if (window.getSelection()?.toString().trim()) emit("selection", props.message);
}

function runId(): string | null {
  const raw = props.message.raw;
  return raw && typeof raw === "object" && typeof Reflect.get(raw, "run_id") === "string"
    ? Reflect.get(raw, "run_id") as string
    : null;
}

function forwardAskSideChat(message: StreamViewMessage, text: string, displayIndex: number) {
  emit("askSideChat", message, text, displayIndex);
}

function handleHumanInputCardSubmit(response: HumanInputResponse) {
  if (!props.humanInputRequest) {
    return;
  }
  emit("submitHumanInput", props.humanInputRequest, response);
}

function readTokenUsage(raw: unknown): {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
} {
  const record = asRecord(raw);
  const candidates = [
    asRecord(record?.usage_metadata),
    asRecord(asRecord(record?.response_metadata)?.token_usage),
    asRecord(asRecord(record?.additional_kwargs)?.usage),
  ];
  for (const usage of candidates) {
    if (!usage) continue;
    const inputTokens = readNumber(usage.input_tokens ?? usage.prompt_tokens);
    const outputTokens = readNumber(usage.output_tokens ?? usage.completion_tokens);
    const totalTokens = readNumber(usage.total_tokens);
    if (inputTokens !== null || outputTokens !== null || totalTokens !== null) {
      return {
        inputTokens,
        outputTokens,
        totalTokens: totalTokens ?? (inputTokens ?? 0) + (outputTokens ?? 0),
      };
    }
  }
  return { inputTokens: null, outputTokens: null, totalTokens: null };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
</script>

<template>
  <article
    class="message-list__item"
    :class="[`message-list__item--${role}`, { 'is-user': role === 'human' }]"
    :data-assistant-turn="role === 'ai' ? 'true' : undefined"
    :data-role="role"
    :data-testid="`vue-message-${role}-${displayIndex - 1}`"
    @mouseup="handleSelection"
  >
    <strong class="message-list__role">{{ role === "human" ? "用户" : role === "ai" ? "AI" : role === "tool" ? "工具" : role === "error" ? "错误" : "消息" }}</strong>
    <MessageToolCards :cards="toolCards" @select-artifact="emit('selectArtifact', $event)" />
    <div v-if="role === 'human'" class="message-list__content message-list__content--plain" data-testid="vue-message-plain-content">{{ message.content }}</div>
    <div v-if="referenceCount > 0" class="message-list__reference-attachment max-w-[min(18rem,100%)]" data-testid="message-reference-attachment">
      {{ referenceCount }} selected text fragment{{ referenceCount === 1 ? "" : "s" }}
    </div>
    <MessageReasoning v-if="role === 'ai' && message.reasoning" :content="message.reasoning" :streaming="isStreaming" />
    <MessageContentRenderer
      v-if="role !== 'human'"
      class="message-list__content"
      :artifact-paths="artifactPaths"
      :content="message.content"
      :is-loading="isStreaming && role === 'ai'"
      :message-element="messageElement"
      :message-role="rendererRole"
      :streaming-reveal="isStreaming && role === 'ai'"
      :thread-id="threadId"
    />
    <MessageRunMeta
      :duration="duration"
      :input-tokens="tokenUsage.inputTokens"
      :output-tokens="tokenUsage.outputTokens"
      :total-tokens="tokenUsage.totalTokens"
      :visible="role === 'ai' && isLastRunAssistant"
    />
    <WorkspaceChangeBadge v-if="role === 'ai' && runId() && isLastRunAssistant" :thread-id="threadId ?? ''" :run-id="runId() ?? ''" />
    <HumanInputCard v-if="humanInputRequest" :request="humanInputRequest" :disabled="disabled" @submit="handleHumanInputCardSubmit" />
    <MessageActions
      :can-branch="canBranch"
      :display-index="displayIndex"
      :message="message"
      :role="role"
      @ask-side-chat="forwardAskSideChat"
      @edit-message="emit('editMessage', $event)"
      @regenerate-message="emit('regenerateMessage', $event)"
      @branch-conversation="emit('branchConversation', $event)"
    />
  </article>
</template>
