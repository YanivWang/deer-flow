import { computed, ref, watch } from "vue";

import {
  AgentNameCheckError,
  AgentsApiDisabledError,
  checkAgentName,
  getAgent,
} from "../core/api/agents/client";
import type { Agent } from "../core/api/agents/types";
import type { DeerFlowMessage } from "../core/api/thread/types";
import {
  buildHumanInputResponseText,
  type HumanInputRequest,
  type HumanInputResponse,
} from "../core/messages/human-input";
import type { StreamViewMessage } from "../core/api/stream/view-model";
import { createId } from "../core/utils/id";

export type NewAgentStep = "name" | "chat";
export type SetupAgentStatus = "idle" | "requested" | "completed";

export type NewAgentStreamAdapter = {
  isBusy: Readonly<{ value: boolean }>;
  sendMessage: (options: {
    additionalKwargs?: Record<string, unknown>;
    context?: Record<string, unknown>;
    text: string;
    threadId: string;
  }) => Promise<void>;
  status: Readonly<{ value: string }>;
  viewModel: Readonly<{ value: { messages: StreamViewMessage[] } }>;
};

export type NewAgentLabels = {
  agentCreatedPendingRefresh: string;
  apiDisabledError: string;
  alreadyExistsError: string;
  bootstrapMessage: string;
  checkError: string;
  checkErrorWithDetail: string;
  invalidNameError: string;
  networkError: string;
  saveCommandMessage: string;
};

export type NewAgentRunContext = {
  agent_name: string;
  is_bootstrap: true;
  is_plan_mode: false;
  mode: "flash";
  subagent_enabled: false;
  thinking_enabled: false;
};

export type UseNewAgentOptions = {
  labels: NewAgentLabels;
  stream: NewAgentStreamAdapter;
  checkName?: typeof checkAgentName;
  createThreadId?: () => string;
  getAgentByName?: typeof getAgent;
  waitMs?: (ms: number) => Promise<void>;
};

const NAME_RE = /^[A-Za-z0-9-]+$/;
const AGENT_READ_RETRY_DELAYS_MS = [200, 500, 1_000, 2_000];

export function useNewAgent({
  labels,
  stream,
  checkName = checkAgentName,
  createThreadId = createId,
  getAgentByName = getAgent,
  waitMs = wait,
}: UseNewAgentOptions) {
  const step = ref<NewAgentStep>("name");
  const nameInput = ref("");
  const nameError = ref("");
  const isCheckingName = ref(false);
  const agentName = ref("");
  const agent = ref<Agent | null>(null);
  const setupAgentStatus = ref<SetupAgentStatus>("idle");
  const statusMessage = ref("");
  const threadId = createThreadId();

  const canContinueName = computed(() => Boolean(nameInput.value.trim()) && !isCheckingName.value);
  const canSaveAgent = computed(
    () =>
      step.value === "chat" &&
      Boolean(agentName.value) &&
      !agent.value &&
      !stream.isBusy.value &&
      setupAgentStatus.value === "idle",
  );

  watch(
    () => [stream.status.value, setupAgentStatus.value, agentName.value] as const,
    () => {
      if (
        setupAgentStatus.value !== "requested" ||
        !agentName.value ||
        !isTerminalStreamStatus(stream.status.value)
      ) {
        return;
      }

      if (!hasToolResult(stream.viewModel.value.messages, "setup_agent")) {
        setupAgentStatus.value = "idle";
        return;
      }

      setupAgentStatus.value = "completed";
      void getAgentWithRetry(agentName.value, getAgentByName, waitMs).then((fetched) => {
        if (fetched) {
          agent.value = fetched;
          statusMessage.value = "";
          return;
        }
        statusMessage.value = labels.agentCreatedPendingRefresh;
      });
    },
  );

  async function confirmName(): Promise<boolean> {
    const trimmed = nameInput.value.trim();
    if (!trimmed) {
      return false;
    }
    if (!NAME_RE.test(trimmed)) {
      nameError.value = labels.invalidNameError;
      return false;
    }

    nameError.value = "";
    isCheckingName.value = true;
    try {
      const result = await checkName(trimmed);
      if (!result.available) {
        nameError.value = labels.alreadyExistsError;
        return false;
      }
      agentName.value = result.name || trimmed;
      step.value = "chat";
      await stream.sendMessage({
        context: buildNewAgentRunContext(agentName.value),
        text: labels.bootstrapMessage.replace("{name}", agentName.value),
        threadId,
      });
      return true;
    } catch (error) {
      nameError.value = nameCheckErrorMessage(error, labels);
      return false;
    } finally {
      isCheckingName.value = false;
    }
  }

  async function submitChatMessage(text: string): Promise<boolean> {
    const trimmed = text.trim();
    if (!trimmed || stream.isBusy.value || !agentName.value) {
      return false;
    }
    await stream.sendMessage({
      context: buildNewAgentRunContext(agentName.value),
      text: trimmed,
      threadId,
    });
    return true;
  }

  async function submitHumanInput(
    request: HumanInputRequest,
    response: HumanInputResponse,
  ): Promise<boolean> {
    if (!agentName.value) {
      return false;
    }

    await stream.sendMessage({
      additionalKwargs: {
        hide_from_ui: true,
        human_input_response: response,
      },
      context: buildNewAgentRunContext(agentName.value),
      text: buildHumanInputResponseText(request, response),
      threadId,
    });
    return true;
  }

  async function saveAgent(): Promise<boolean> {
    if (!canSaveAgent.value) {
      return false;
    }

    setupAgentStatus.value = "requested";
    statusMessage.value = "";
    try {
      await stream.sendMessage({
        additionalKwargs: { hide_from_ui: true },
        context: buildNewAgentRunContext(agentName.value),
        text: labels.saveCommandMessage,
        threadId,
      });
      return true;
    } catch (error) {
      setupAgentStatus.value = "idle";
      statusMessage.value = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  function clearNameError(): void {
    nameError.value = "";
  }

  return {
    agent,
    agentName,
    canContinueName,
    canSaveAgent,
    clearNameError,
    confirmName,
    isCheckingName,
    nameError,
    nameInput,
    saveAgent,
    setupAgentStatus,
    statusMessage,
    step,
    submitChatMessage,
    submitHumanInput,
    threadId,
  };
}

export function buildNewAgentRunContext(agentName: string): NewAgentRunContext {
  return {
    agent_name: agentName,
    is_bootstrap: true,
    is_plan_mode: false,
    mode: "flash",
    subagent_enabled: false,
    thinking_enabled: false,
  };
}

export function hasToolResult(messages: Array<DeerFlowMessage | StreamViewMessage>, toolName: string): boolean {
  const matchingToolCallIds = new Set<string>();
  const rawMessages = messages.map((message) => readRawMessage(message));
  for (const message of rawMessages) {
    if (message.type !== "ai") {
      continue;
    }
    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    for (const toolCall of toolCalls) {
      if (!isRecord(toolCall)) {
        continue;
      }
      if (toolCall.name === toolName && typeof toolCall.id === "string" && toolCall.id) {
        matchingToolCallIds.add(toolCall.id);
      }
    }
  }

  return rawMessages.some(
    (message) =>
      message.type === "tool" &&
      (message.name === toolName ||
        (typeof message.tool_call_id === "string" &&
          matchingToolCallIds.has(message.tool_call_id))),
  );
}

function isTerminalStreamStatus(value: string): boolean {
  return value === "completed" || value === "aborted" || value === "error";
}

async function getAgentWithRetry(
  agentName: string,
  getAgentByName: typeof getAgent,
  waitMs: (ms: number) => Promise<void>,
): Promise<Agent | null> {
  for (const delay of [0, ...AGENT_READ_RETRY_DELAYS_MS]) {
    if (delay > 0) {
      await waitMs(delay);
    }
    try {
      return await getAgentByName(agentName);
    } catch {
      // Retry while setup_agent persistence settles.
    }
  }

  return null;
}

function nameCheckErrorMessage(error: unknown, labels: NewAgentLabels): string {
  if (error instanceof AgentsApiDisabledError) {
    return labels.apiDisabledError;
  }
  if (error instanceof AgentNameCheckError && error.reason === "backend_unreachable") {
    return labels.networkError;
  }
  if (error instanceof AgentNameCheckError && error.reason === "request_failed") {
    return error.detail
      ? labels.checkErrorWithDetail.replace("{detail}", error.detail)
      : labels.checkError;
  }
  return labels.checkError;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRawMessage(message: DeerFlowMessage | StreamViewMessage): DeerFlowMessage {
  if (isRecord(message) && isRecord(message.raw)) {
    return message.raw;
  }
  return message as DeerFlowMessage;
}
