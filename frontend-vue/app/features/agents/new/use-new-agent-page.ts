import { computed, ref, watch } from "vue";

import type { HumanInputRequest, HumanInputResponse } from "../../../core/messages/human-input";
import type { StreamViewMessage } from "../../../core/stream/view-model";
import {
  useNewAgent,
  type NewAgentStreamAdapter,
} from "./use-new-agent";

const SAVE_HINT_STORAGE_KEY = "deerflow.agent-create.save-hint-seen";

export function useNewAgentPage(options: { stream: NewAgentStreamAdapter }) {
  const newAgent = useNewAgent({
    labels: {
      agentCreatedPendingRefresh:
        "智能体已创建，但 DeerFlow 暂时还无法加载它。请稍后刷新此页面。",
      apiDisabledError: "当前服务器未启用自定义智能体管理。请联系管理员。",
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
    stream: options.stream,
  });
  const chatDraft = ref("");
  const showSaveHint = ref(false);

  watch(
    () => newAgent.step.value,
    (step) => {
      if (step !== "chat" || showSaveHint.value || hasSeenSaveHint()) {
        return;
      }
      showSaveHint.value = true;
      markSaveHintSeen();
    },
    { immediate: true },
  );

  const streamMessages = computed<StreamViewMessage[]>(() =>
    newAgent.step.value === "chat" ? options.stream.viewModel.value.messages : [],
  );
  const streamStatus = computed(() => options.stream.status.value);
  const isBusy = computed(() => options.stream.isBusy.value);
  const isStreaming = computed(
    () => options.stream.isStreaming?.value ?? options.stream.isBusy.value,
  );

  async function submitChatDraft(): Promise<void> {
    const sent = await newAgent.submitChatMessage(chatDraft.value);
    if (sent) {
      chatDraft.value = "";
    }
  }

  async function saveAgent(): Promise<boolean> {
    showSaveHint.value = false;
    return newAgent.saveAgent();
  }

  return {
    agent: newAgent.agent,
    agentName: newAgent.agentName,
    canContinueName: newAgent.canContinueName,
    canSaveAgent: newAgent.canSaveAgent,
    chatDraft,
    clearNameError: newAgent.clearNameError,
    confirmName: newAgent.confirmName,
    isBusy,
    isCheckingName: newAgent.isCheckingName,
    isStreaming,
    nameError: newAgent.nameError,
    nameInput: newAgent.nameInput,
    saveAgent,
    setupAgentStatus: newAgent.setupAgentStatus,
    showSaveHint,
    statusMessage: newAgent.statusMessage,
    step: newAgent.step,
    streamMessages,
    streamStatus,
    submitChatDraft,
    submitHumanInput: (request: HumanInputRequest, response: HumanInputResponse) =>
      newAgent.submitHumanInput(request, response),
  };
}

function hasSeenSaveHint(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(SAVE_HINT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSaveHintSeen(): void {
  try {
    window.localStorage.setItem(SAVE_HINT_STORAGE_KEY, "1");
  } catch {
    return;
  }
}

export type NewAgentPageController = ReturnType<typeof useNewAgentPage>;
