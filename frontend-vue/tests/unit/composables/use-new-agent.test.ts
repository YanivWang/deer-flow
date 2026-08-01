import { flushPromises } from "@vue/test-utils";
import { computed, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import {
  AgentNameCheckError,
  AgentsApiDisabledError,
} from "../../../app/core/api/agents/client";
import type { Agent } from "../../../app/core/api/agents/types";
import type { StreamViewMessage } from "../../../app/core/api/stream/view-model";
import type { HumanInputRequest } from "../../../app/core/messages/human-input";
import {
  buildNewAgentRunContext,
  hasToolResult,
  useNewAgent,
} from "../../../app/composables/use-new-agent";

describe("useNewAgent", () => {
  it("validates names and sends the bootstrap message with normalized agent context", async () => {
    const stream = createStreamMock();
    const newAgent = useNewAgent({
      labels,
      stream,
      checkName: vi.fn(async () => ({ available: true, name: "researcher" })),
      createThreadId: () => "thread-new",
    });

    newAgent.nameInput.value = "bad name";
    await expect(newAgent.confirmName()).resolves.toBe(false);
    expect(newAgent.nameError.value).toBe(labels.invalidNameError);

    newAgent.nameInput.value = "Researcher";
    await expect(newAgent.confirmName()).resolves.toBe(true);

    expect(newAgent.step.value).toBe("chat");
    expect(newAgent.agentName.value).toBe("researcher");
    expect(stream.sendMessage).toHaveBeenCalledWith({
      context: buildNewAgentRunContext("researcher"),
      text: "bootstrap researcher",
      threadId: "thread-new",
    });
  });

  it("builds the bootstrap flash context expected by the backend setup_agent flow", () => {
    expect(buildNewAgentRunContext("researcher")).toEqual({
      agent_name: "researcher",
      is_bootstrap: true,
      is_plan_mode: false,
      mode: "flash",
      subagent_enabled: false,
      thinking_enabled: false,
    });
  });

  it("surfaces disabled, network, detailed, and unavailable name-check errors", async () => {
    const cases = [
      {
        error: new AgentsApiDisabledError("agents_api.enabled=false"),
        message: labels.apiDisabledError,
      },
      {
        error: new AgentNameCheckError("network", "backend_unreachable"),
        message: labels.networkError,
      },
      {
        error: new AgentNameCheckError("bad", "request_failed", "Bad name"),
        message: "detail Bad name",
      },
      {
        error: new AgentNameCheckError("bad", "request_failed"),
        message: labels.checkError,
      },
    ];

    for (const item of cases) {
      const newAgent = useNewAgent({
        labels,
        stream: createStreamMock(),
        checkName: vi.fn(async () => {
          throw item.error;
        }),
        createThreadId: () => "thread-new",
      });
      newAgent.nameInput.value = "researcher";

      await expect(newAgent.confirmName()).resolves.toBe(false);
      expect(newAgent.nameError.value).toBe(item.message);
    }

    const unavailable = useNewAgent({
      labels,
      stream: createStreamMock(),
      checkName: vi.fn(async () => ({ available: false, name: "researcher" })),
      createThreadId: () => "thread-new",
    });
    unavailable.nameInput.value = "researcher";
    await unavailable.confirmName();
    expect(unavailable.nameError.value).toBe(labels.alreadyExistsError);
  });

  it("sends save and human-input replies as hidden messages in the custom-agent context", async () => {
    const stream = createStreamMock();
    const newAgent = useNewAgent({
      labels,
      stream,
      checkName: vi.fn(async () => ({ available: true, name: "researcher" })),
      createThreadId: () => "thread-new",
    });
    newAgent.nameInput.value = "researcher";
    await newAgent.confirmName();
    stream.sendMessage.mockClear();

    await expect(newAgent.saveAgent()).resolves.toBe(true);
    expect(stream.sendMessage).toHaveBeenCalledWith({
      additionalKwargs: { hide_from_ui: true },
      context: buildNewAgentRunContext("researcher"),
      text: labels.saveCommandMessage,
      threadId: "thread-new",
    });

    const request: HumanInputRequest = {
      version: 1,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "request-1",
      question: "Pick one?",
      input_mode: "single_choice",
      options: [{ id: "yes", label: "Yes", value: "yes" }],
    };
    await expect(
      newAgent.submitHumanInput(request, {
        version: 1,
        kind: "human_input_response",
        source: "ask_clarification",
        request_id: "request-1",
        response_kind: "option",
        option_id: "yes",
        value: "yes",
      }),
    ).resolves.toBe(true);

    expect(stream.sendMessage).toHaveBeenLastCalledWith({
      additionalKwargs: {
        hide_from_ui: true,
        human_input_response: {
          version: 1,
          kind: "human_input_response",
          source: "ask_clarification",
          request_id: "request-1",
          response_kind: "option",
          option_id: "yes",
          value: "yes",
        },
      },
      context: buildNewAgentRunContext("researcher"),
      text: "关于“Pick one?”，我的回答是：yes",
      threadId: "thread-new",
    });
  });

  it("detects setup_agent tool results and retries agent readback after save completes", async () => {
    const messages = ref<StreamViewMessage[]>([]);
    const status = ref("idle");
    const stream = createStreamMock({ messages, status });
    const getAgentByName = vi
      .fn<[], Promise<Agent>>()
      .mockRejectedValueOnce(new Error("not ready"))
      .mockResolvedValueOnce(agent("researcher"));
    const newAgent = useNewAgent({
      labels,
      stream,
      checkName: vi.fn(async () => ({ available: true, name: "researcher" })),
      createThreadId: () => "thread-new",
      getAgentByName,
      waitMs: vi.fn(async () => {}),
    });
    newAgent.nameInput.value = "researcher";
    await newAgent.confirmName();
    await newAgent.saveAgent();

    messages.value = [
      viewMessage({
        id: "ai-1",
        type: "ai",
        tool_calls: [{ id: "tool-1", name: "setup_agent" }],
      }),
      viewMessage({ id: "tool-result-1", type: "tool", tool_call_id: "tool-1", content: "OK" }),
    ];
    status.value = "completed";
    await nextTick();
    await nextTick();
    await flushPromises();

    expect(newAgent.setupAgentStatus.value).toBe("completed");
    expect(getAgentByName).toHaveBeenCalledTimes(2);
    expect(newAgent.agent.value?.name).toBe("researcher");
  });

  it("matches setup_agent tool results by direct tool name or tool_call_id", () => {
    expect(hasToolResult([{ type: "tool", name: "setup_agent", content: "OK" }], "setup_agent")).toBe(
      true,
    );
    expect(
      hasToolResult(
        [
          { type: "ai", tool_calls: [{ id: "call-1", name: "setup_agent" }] },
          { type: "tool", tool_call_id: "call-1", content: "OK" },
        ],
        "setup_agent",
      ),
    ).toBe(true);
  });
});

const labels = {
  agentCreatedPendingRefresh: "pending refresh",
  apiDisabledError: "api disabled",
  alreadyExistsError: "already exists",
  bootstrapMessage: "bootstrap {name}",
  checkError: "check failed",
  checkErrorWithDetail: "detail {detail}",
  invalidNameError: "invalid name",
  networkError: "network failed",
  saveCommandMessage: "save now",
};

function createStreamMock({
  busy = ref(false),
  messages = ref<StreamViewMessage[]>([]),
  status = ref("idle"),
}: {
  busy?: ReturnType<typeof ref<boolean>>;
  messages?: ReturnType<typeof ref<StreamViewMessage[]>>;
  status?: ReturnType<typeof ref<string>>;
} = {}) {
  return {
    isBusy: busy,
    sendMessage: vi.fn(async () => {}),
    status,
    viewModel: computed(() => ({ messages: messages.value })),
  };
}

function viewMessage(raw: Record<string, unknown>): StreamViewMessage {
  return {
    id: typeof raw.id === "string" ? raw.id : undefined,
    role: typeof raw.type === "string" ? raw.type : "unknown",
    content: typeof raw.content === "string" ? raw.content : "",
    raw,
  };
}

function agent(name: string): Agent {
  return {
    name,
    description: "Research helper",
    model: null,
    tool_groups: null,
    skills: null,
  };
}
