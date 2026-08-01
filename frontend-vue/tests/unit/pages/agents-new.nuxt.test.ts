import { mountSuspended, mockNuxtImport } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { useRouter } from "#app";
import { computed, ref, type ComputedRef, type Ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NewAgentPage from "../../../app/pages/workspace/agents/new.vue";
import type { StreamViewMessage } from "../../../app/core/api/stream/view-model";

type StreamMock = {
  isBusy: Ref<boolean>;
  sendMessage: ReturnType<typeof vi.fn>;
  status: Ref<string>;
  viewModel: ComputedRef<{ messages: StreamViewMessage[] }>;
};

const nuxtMocks = vi.hoisted(() => ({
  stream: undefined as StreamMock | undefined,
}));

mockNuxtImport("useThreadStream", () => () => {
  if (!nuxtMocks.stream) {
    throw new Error("useThreadStream mock was not configured.");
  }
  return nuxtMocks.stream;
});

describe("agents new page", () => {
  beforeEach(() => {
    nuxtMocks.stream = createStreamMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("checks the name and starts bootstrap chat in the custom-agent context", async () => {
    const fetchMock = vi.fn(async () => Response.json({ available: true, name: "researcher" }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(NewAgentPage, { route: "/workspace/agents/new" });

    await wrapper.get('[data-testid="vue-new-agent-name"]').setValue("Researcher");
    await wrapper.get('[data-testid="vue-new-agent-continue"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agents/check?name=Researcher",
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
    expect(nuxtMocks.stream?.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          agent_name: "researcher",
          is_bootstrap: true,
          is_plan_mode: false,
          mode: "flash",
          subagent_enabled: false,
          thinking_enabled: false,
        },
        text: expect.stringContaining("researcher"),
      }),
    );
    expect(wrapper.get('[data-testid="vue-new-agent-active-name"]').text()).toContain(
      "researcher",
    );
    expect(wrapper.get(".new-agent-status-row").attributes("role")).toBe("status");
  });

  it("exposes name validation errors through alert semantics", async () => {
    const wrapper = await mountSuspended(NewAgentPage, { route: "/workspace/agents/new" });

    await wrapper.get('[data-testid="vue-new-agent-name"]').setValue("bad name");
    await wrapper.get('[data-testid="vue-new-agent-name"]').trigger("keydown.enter");
    await flushPromises();

    const error = wrapper.get('[data-testid="vue-new-agent-name-error"]');
    expect(error.attributes("id")).toBe("vue-new-agent-name-error-message");
    expect(error.attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="vue-new-agent-name"]').attributes("aria-invalid")).toBe(
      "true",
    );
    expect(wrapper.get('[data-testid="vue-new-agent-name"]').attributes("aria-describedby")).toBe(
      "vue-new-agent-name-error-message",
    );
  });

  it("sends save command hidden and renders created state after setup_agent result readback", async () => {
    const messages = ref<StreamViewMessage[]>([]);
    const status = ref("idle");
    nuxtMocks.stream = createStreamMock({ messages, status });
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ available: true, name: "researcher" }))
      .mockResolvedValueOnce(
        Response.json({
          name: "researcher",
          description: "Research helper",
          model: null,
          tool_groups: null,
          skills: null,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = await mountSuspended(NewAgentPage, { route: "/workspace/agents/new" });
    await wrapper.get('[data-testid="vue-new-agent-name"]').setValue("researcher");
    await wrapper.get('[data-testid="vue-new-agent-continue"]').trigger("click");
    await flushPromises();
    nuxtMocks.stream?.sendMessage.mockClear();

    await wrapper.get('[data-testid="vue-new-agent-save"]').trigger("click");
    await flushPromises();

    expect(nuxtMocks.stream?.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalKwargs: { hide_from_ui: true },
        context: {
          agent_name: "researcher",
          is_bootstrap: true,
          is_plan_mode: false,
          mode: "flash",
          subagent_enabled: false,
          thinking_enabled: false,
        },
        text: expect.stringContaining("setup_agent"),
      }),
    );

    messages.value = [
      viewMessage({
        id: "ai-1",
        type: "ai",
        tool_calls: [{ id: "call-1", name: "setup_agent" }],
      }),
      viewMessage({ id: "tool-1", type: "tool", tool_call_id: "call-1", content: "OK" }),
    ];
    status.value = "completed";
    await flushPromises();
    await flushPromises();

    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/agents/researcher");
    expect(wrapper.get('[data-testid="vue-new-agent-created"]').text()).toContain(
      "Research helper",
    );
    expect(wrapper.get('[data-testid="vue-new-agent-created"]').attributes("role")).toBe(
      "status",
    );
  });

  it("routes back to gallery without touching the forbidden React route", async () => {
    const router = useRouter();
    const pushSpy = vi.spyOn(router, "push").mockResolvedValue();
    const wrapper = await mountSuspended(NewAgentPage, { route: "/workspace/agents/new" });

    await wrapper.get('[data-testid="vue-new-agent-back"]').trigger("click");

    expect(pushSpy).toHaveBeenCalledWith("/workspace/agents");
  });
});

function createStreamMock({
  busy = ref(false),
  messages = ref<StreamViewMessage[]>([]),
  status = ref("idle"),
}: {
  busy?: Ref<boolean>;
  messages?: Ref<StreamViewMessage[]>;
  status?: Ref<string>;
} = {}): StreamMock {
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
