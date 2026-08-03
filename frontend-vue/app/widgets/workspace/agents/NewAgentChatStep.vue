<script setup lang="ts">
import type { Agent } from "../../../core/api/agents/types";
import type { StreamViewMessage } from "../../../core/stream/view-model";
import type { HumanInputRequest, HumanInputResponse } from "../../../core/messages/human-input";
import type { SetupAgentStatus } from "../../../features/agents/new/use-new-agent";
import MessageList from "../messages/MessageList.vue";

const props = defineProps<{
  agent: Agent | null;
  agentName: string;
  chatDraft: string;
  isBusy: boolean;
  isStreaming: boolean;
  messages: StreamViewMessage[];
  setupAgentStatus: SetupAgentStatus;
  showSaveHint: boolean;
  statusMessage: string;
  streamStatus: string;
}>();

const emit = defineEmits<{
  "update:chatDraft": [value: string];
  backToGallery: [];
  startChatting: [];
  submitChat: [];
  submitHumanInput: [request: HumanInputRequest, response: HumanInputResponse];
}>();

function updateDraft(event: Event): void {
  const target = event.target;
  emit("update:chatDraft", target instanceof HTMLTextAreaElement ? target.value : "");
}
</script>

<template>
  <section class="new-agent-chat-step">
    <div v-if="props.showSaveHint" class="new-agent-save-hint" data-testid="vue-new-agent-save-hint" role="status">
      你可以在右上角的更多操作中随时保存这个智能体，即使当前还只是初稿。
    </div>
    <div class="new-agent-status-row" role="status">
      <span data-testid="vue-new-agent-active-name">智能体：{{ props.agentName }}</span>
      <span data-testid="vue-new-agent-stream-status">流状态：{{ props.streamStatus }}</span>
    </div>
    <p
      v-if="props.setupAgentStatus === 'requested'"
      class="workspace-notice"
      data-testid="vue-new-agent-save-requested"
      role="status"
    >
      已请求保存。DeerFlow 正在生成并保存初始版本。
    </p>
    <p
      v-if="props.statusMessage"
      class="workspace-error"
      data-testid="vue-new-agent-status-message"
      role="alert"
    >
      {{ props.statusMessage }}
    </p>

    <MessageList
      :disabled="props.isBusy"
      :is-streaming="props.isStreaming"
      :messages="props.messages"
      @submit-human-input="(request, response) => emit('submitHumanInput', request, response)"
    />

    <div v-if="props.agent" class="new-agent-created" data-testid="vue-new-agent-created" role="status">
      <div>
        <strong>智能体已创建。</strong>
        <span>{{ props.agent.description || props.agent.name }}</span>
      </div>
      <div class="new-agent-created__actions">
        <button
          class="workspace-button workspace-button--primary"
          data-testid="vue-new-agent-start-chatting"
          type="button"
          @click="emit('startChatting')"
        >
          开始对话
        </button>
        <button
          class="workspace-button workspace-button--ghost"
          data-testid="vue-new-agent-back-to-gallery"
          type="button"
          @click="emit('backToGallery')"
        >
          返回智能体画廊
        </button>
      </div>
    </div>
    <form v-else class="new-agent-composer" @submit.prevent="emit('submitChat')">
      <textarea
        :value="props.chatDraft"
        data-testid="vue-new-agent-chat-input"
        :disabled="props.isBusy"
        placeholder="告诉 DeerFlow 这个智能体应该做什么。"
        @input="updateDraft"
      />
      <button
        class="workspace-button workspace-button--primary"
        data-testid="vue-new-agent-chat-submit"
        :disabled="props.isBusy || !props.chatDraft.trim()"
        type="submit"
      >
        发送
      </button>
    </form>
  </section>
</template>
