import { mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AgentsIndexPage from "../../../app/pages/workspace/agents/index.vue";

describe("agents gallery page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("deerflow.features.agents_api", "true");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders capability cards and encoded chat routes from Gateway data", async () => {
    const fetchMock = mockAgentsFetch([
      {
        name: "Research Agent",
        description: "Research helper",
        model: "deep-model",
        tool_groups: ["search"],
        skills: ["web"],
      },
    ]);
    const wrapper = await mountSuspended(AgentsIndexPage, { route: "/workspace/agents" });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/agents", expect.objectContaining({ credentials: "include" }));
    expect(wrapper.get('[data-testid="vue-agent-card-Research Agent"]').text()).toContain("Research helper");
    expect(wrapper.get('[data-testid="vue-agent-card-capabilities"]').text()).toContain("search");
    expect(wrapper.get('[data-testid="vue-agent-card-chat-Research Agent"]').attributes("href")).toBe(
      "/workspace/agents/Research%20Agent/chats/new",
    );
    expect(wrapper.get('[data-testid="vue-agents-new-link"]').attributes("href")).toBe(
      "/workspace/agents/new",
    );
  });

  it("renders the source-backed empty state with a create affordance", async () => {
    mockAgentsFetch([]);
    const wrapper = await mountSuspended(AgentsIndexPage, { route: "/workspace/agents" });
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-agents-empty"]').text()).toContain("No custom agents yet");
    expect(wrapper.get('[data-testid="vue-agents-empty"] a').attributes("href")).toBe(
      "/workspace/agents/new",
    );
  });

  it("validates settings before PUT and sends model capabilities on save", async () => {
    const fetchMock = mockAgentsFetch([
      {
        name: "researcher",
        description: "Research helper",
        model: null,
        tool_groups: null,
        skills: null,
      },
    ]);
    const wrapper = await mountSuspended(AgentsIndexPage, { route: "/workspace/agents" });
    await flushPromises();
    await wrapper.get('[data-testid="vue-agent-card-settings-researcher"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-agent-settings-thinking"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="vue-agent-settings-reasoning"]').exists()).toBe(true);
    await wrapper.get('[data-testid="vue-agent-settings-temperature"]').setValue("2.1");
    await wrapper.get(".workspace-dialog__fields").trigger("submit");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-agent-settings-validation"]').text()).toContain("between 0 and 2");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);

    await wrapper.get('[data-testid="vue-agent-settings-temperature"]').setValue("0.7");
    await wrapper.get('[data-testid="vue-agent-settings-max-tokens"]').setValue("100");
    await wrapper.get('[data-testid="vue-agent-settings-thinking"]').setValue("on");
    await wrapper.get('[data-testid="vue-agent-settings-reasoning"]').setValue("high");
    await wrapper.get(".workspace-dialog__fields").trigger("submit");
    await flushPromises();

    const update = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(update?.[0]).toBe("/api/agents/researcher");
    expect(JSON.parse(String(update?.[1]?.body))).toEqual({
      model: null,
      model_settings: { temperature: 0.7, max_tokens: 100 },
      thinking_enabled: true,
      reasoning_effort: "high",
    });
  });

  it("confirms deletion through the existing CSRF-aware agent client", async () => {
    const fetchMock = mockAgentsFetch([
      { name: "writer", description: "Writer", model: null, tool_groups: null, skills: null },
    ]);
    const wrapper = await mountSuspended(AgentsIndexPage, { route: "/workspace/agents" });
    await flushPromises();
    await wrapper.get('[data-testid="vue-agent-card-delete-writer"]').trigger("click");
    expect(wrapper.get('[data-testid="vue-agent-delete-dialog"]').exists()).toBe(true);
    await wrapper.get('[data-testid="vue-agent-delete-confirm"]').trigger("click");
    await flushPromises();

    const deletion = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(deletion?.[0]).toBe("/api/agents/writer");
    expect(wrapper.get('[data-testid="vue-agents-action-message"]').text()).toContain("已删除");
  });
});

function mockAgentsFetch(agents: Array<Record<string, unknown>>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === "/api/features") return Response.json({ agents_api: { enabled: true } });
    if (path.startsWith("/api/agents/") && init?.method === "DELETE") return new Response(null, { status: 204 });
    if (path === "/api/agents" && (!init?.method || init.method === "GET")) return Response.json({ agents });
    if (path === "/api/models") {
      return Response.json({
        models: [
          { name: "deep-model", display_name: "Deep", supports_thinking: true, supports_reasoning_effort: true },
        ],
      });
    }
    if (path.startsWith("/api/agents/") && init?.method === "PUT") {
      return Response.json({ ...agents[0], ...JSON.parse(String(init.body)) });
    }
    return Response.json({ detail: `Unexpected request: ${path}` }, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
