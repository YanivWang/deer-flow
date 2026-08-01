<script setup lang="ts">
import { computed, ref } from "vue";

import MessageList from "../../../components/workspace/messages/MessageList.vue";
import { useNewAgent } from "../../../composables/use-new-agent";

const router = useRouter();
const stream = useThreadStream();
const chatDraft = ref("");

const newAgent = useNewAgent({
  labels: {
    agentCreatedPendingRefresh:
      "智能体已创建，但 DeerFlow 暂时还无法加载它。请稍后刷新此页面。",
    apiDisabledError:
      "当前服务器未启用自定义智能体管理。请联系管理员。",
    alreadyExistsError: "已存在同名智能体。",
    bootstrapMessage:
      "新的自定义智能体名称是 {name}。请帮我设计它的目标、行为和 SOUL.md，然后再保存。",
    checkError: "无法检查名称是否可用，请重试。",
    checkErrorWithDetail: "名称检查失败：{detail}",
    invalidNameError: "只能使用字母、数字和连字符。",
    networkError: "网络请求失败，请检查后端连接。",
    saveCommandMessage:
      "请根据目前讨论的全部内容保存这个自定义智能体。这是我明确确认保存。如果仍有细节缺失，请做合理假设，生成一份简洁的初版 SOUL.md，并立即调用 setup_agent，不要再向我确认。",
  },
  stream,
});

const streamMessages = computed(() =>
  newAgent.step.value === "chat" ? stream.viewModel.value.messages : [],
);
const streamStatus = computed(() => stream.status.value);
const isBusy = computed(() => stream.isBusy.value);
const isStreaming = computed(() => stream.isStreaming?.value ?? stream.isBusy.value);
const nameErrorId = "vue-new-agent-name-error-message";
const statusMessageId = "vue-new-agent-status-message-text";

async function submitChatDraft() {
  const sent = await newAgent.submitChatMessage(chatDraft.value);
  if (sent) {
    chatDraft.value = "";
  }
}
</script>

<template>
  <WorkspaceNavShell>
  <section class="new-agent-page">
    <header class="new-agent-header">
      <button
        class="workspace-button workspace-button--ghost"
        data-testid="vue-new-agent-back"
        type="button"
        @click="router.push('/workspace/agents')"
      >
        返回
      </button>
      <div>
        <h1>设计你的智能体</h1>
        <p>描述你想要的自定义智能体，并通过 DeerFlow 保存。</p>
      </div>
      <button
        v-if="newAgent.step.value === 'chat'"
        class="workspace-button"
        data-testid="vue-new-agent-save"
        :disabled="!newAgent.canSaveAgent.value"
        type="button"
        @click="newAgent.saveAgent"
      >
        {{ newAgent.setupAgentStatus.value === "requested" ? "正在保存智能体..." : "保存智能体" }}
      </button>
    </header>

    <section v-if="newAgent.step.value === 'name'" class="new-agent-name-step">
      <div class="new-agent-name-card">
        <h2>命名你的新智能体</h2>
        <p>只能使用字母、数字和连字符。DeerFlow 会存储规范化后的后端名称。</p>
        <label class="workspace-field">
          <span>名称</span>
          <input
            v-model="newAgent.nameInput.value"
            autocomplete="off"
            data-testid="vue-new-agent-name"
            placeholder="code-reviewer"
            :aria-describedby="newAgent.nameError.value ? nameErrorId : undefined"
            :aria-invalid="Boolean(newAgent.nameError.value)"
            @input="newAgent.clearNameError"
            @keydown.enter.prevent="newAgent.confirmName"
          >
        </label>
        <p
          v-if="newAgent.nameError.value"
          :id="nameErrorId"
          class="workspace-error"
          data-testid="vue-new-agent-name-error"
          role="alert"
        >
          {{ newAgent.nameError.value }}
        </p>
        <button
          class="workspace-button workspace-button--primary"
          data-testid="vue-new-agent-continue"
          :disabled="!newAgent.canContinueName.value"
          type="button"
          @click="newAgent.confirmName"
        >
          {{ newAgent.isCheckingName.value ? "正在检查..." : "继续" }}
        </button>
      </div>
    </section>

    <section v-else class="new-agent-chat-step">
      <div class="new-agent-status-row" role="status">
        <span data-testid="vue-new-agent-active-name">智能体：{{ newAgent.agentName.value }}</span>
        <span data-testid="vue-new-agent-stream-status">流状态：{{ streamStatus }}</span>
      </div>
      <p
        v-if="newAgent.setupAgentStatus.value === 'requested'"
        class="workspace-notice"
        data-testid="vue-new-agent-save-requested"
        role="status"
      >
        已请求保存。DeerFlow 正在生成并保存初始版本。
      </p>
      <p
        v-if="newAgent.statusMessage.value"
        :id="statusMessageId"
        class="workspace-error"
        data-testid="vue-new-agent-status-message"
        role="alert"
      >
        {{ newAgent.statusMessage.value }}
      </p>

      <MessageList
        :messages="streamMessages"
        :disabled="isBusy"
        :is-streaming="isStreaming"
        @submit-human-input="newAgent.submitHumanInput"
      />

      <div v-if="newAgent.agent.value" class="new-agent-created" data-testid="vue-new-agent-created" role="status">
        <strong>智能体已创建。</strong>
        <span>{{ newAgent.agent.value.description || newAgent.agent.value.name }}</span>
        <button
          class="workspace-button workspace-button--primary"
          data-testid="vue-new-agent-start-chatting"
          type="button"
          @click="router.push(`/workspace/agents/${encodeURIComponent(newAgent.agentName.value)}/chats/new`)"
        >
          开始对话
        </button>
      </div>
      <form v-else class="new-agent-composer" @submit.prevent="submitChatDraft">
        <textarea
          v-model="chatDraft"
          data-testid="vue-new-agent-chat-input"
          :disabled="isBusy"
          :aria-describedby="newAgent.statusMessage.value ? statusMessageId : undefined"
          placeholder="告诉 DeerFlow 这个智能体应该做什么。"
        />
        <button
          class="workspace-button workspace-button--primary"
          data-testid="vue-new-agent-chat-submit"
          :disabled="isBusy || !chatDraft.trim()"
          type="submit"
        >
          发送
        </button>
      </form>
    </section>
  </section>
  </WorkspaceNavShell>
</template>
