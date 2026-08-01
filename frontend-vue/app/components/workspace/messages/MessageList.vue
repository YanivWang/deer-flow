<script setup lang="ts">
import { computed } from "vue";

import type { StreamViewMessage } from "../../../core/api/stream/view-model";
import {
  extractHumanInputRequest,
  type HumanInputRequest,
  type HumanInputResponse,
} from "../../../core/messages/human-input";
import { extractToolRichCards } from "../../../core/messages/tool-cards";

const props = defineProps<{
  artifactPaths?: readonly string[];
  disabled?: boolean;
  isStreaming?: boolean;
  messages: StreamViewMessage[];
  threadId?: string;
}>();

const emit = defineEmits<{
  submitHumanInput: [request: HumanInputRequest, response: HumanInputResponse];
}>();

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

</script>

<template>
  <article
    v-for="({ message, humanInputRequest, toolCards }, index) in renderedMessages"
    :key="message.id || `${message.role}-${index}`"
    class="message-list__item"
    :class="`message-list__item--${groupRole(message.role)}`"
    :data-role="groupRole(message.role)"
    :data-testid="`vue-message-${groupRole(message.role)}-${index}`"
  >
    <strong class="message-list__role">{{ labelOfRole(message.role) }}</strong>
    <div v-if="toolCards.length > 0" class="message-list__tool-cards">
      <ToolRichCard
        v-for="card in toolCards"
        :key="`${card.kind}-${card.id ?? card.name}-${card.title}`"
        :card="card"
      />
    </div>
    <RichMessageContent
      class="message-list__content"
      :artifact-paths="artifactPaths"
      :content="message.content"
      :streaming-reveal="isStreaming && groupRole(message.role) === 'ai'"
      :thread-id="threadId"
    />
    <HumanInputCard
      v-if="humanInputRequest"
      :request="humanInputRequest"
      :disabled="disabled"
      @submit="emit('submitHumanInput', humanInputRequest, $event)"
    />
  </article>
</template>
