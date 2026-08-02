import { mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import WorkspaceNavShell from "../../../app/components/workspace/WorkspaceNavShell.vue";
import AgentsIndexPage from "../../../app/pages/workspace/agents/index.vue";
import ChatsIndexPage from "../../../app/pages/workspace/chats/index.vue";
import SettingsPage from "../../../app/pages/workspace/settings.vue";
import WorkspaceIndexPage from "../../../app/pages/workspace/index.vue";

describe("workspace navigation shell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("deerflow.features.agents_api", "true");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders workspace home cards that point at Vue workspace routes", async () => {
    const wrapper = await mountSuspended(WorkspaceIndexPage, { route: "/workspace" });

    expect(wrapper.get('[data-testid="vue-workspace-nav"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="vue-workspace-header"]').text()).toContain("Home");
    expect(wrapper.get('[data-testid="vue-workspace-github"]').attributes("href")).toBe(
      "https://github.com/bytedance/deer-flow",
    );
    expect(wrapper.get(".workspace-nav-shell__skip").attributes("href")).toBe(
      "#workspace-main-content",
    );
    expect(wrapper.get("#workspace-main-content").attributes("tabindex")).toBe("-1");
    expect(wrapper.get('[data-testid="vue-workspace-card-chat"]').attributes("href")).toBe(
      "/workspace/chats/new",
    );
    expect(wrapper.get('[data-testid="vue-workspace-card-agents"]').attributes("href")).toBe(
      "/workspace/agents",
    );
    expect(wrapper.get('[data-testid="vue-workspace-card-scheduled"]').attributes("href")).toBe(
      "/workspace/scheduled-tasks",
    );
    expect(wrapper.get('[data-testid="vue-workspace-card-settings"]').attributes("href")).toBe(
      "/workspace/settings",
    );
    expect(wrapper.get('[data-testid="vue-workspace-nav-new-chat"]').text()).toContain("New chat");
    expect(wrapper.get('[data-testid="vue-workspace-nav-scheduled"]').text()).toContain(
      "Scheduled tasks",
    );
  });

  it("keeps new-chat active state specific instead of double-marking chats", async () => {
    const wrapper = await mountSuspended(WorkspaceNavShell, { route: "/workspace/chats/new" });

    expect(wrapper.get('[data-testid="vue-workspace-nav-new-chat"]').classes()).toContain(
      "workspace-nav-shell__link--active",
    );
    expect(wrapper.get('[data-testid="vue-workspace-nav-chats"]').classes()).not.toContain(
      "workspace-nav-shell__link--active",
    );
    expect(wrapper.get('[data-testid="vue-workspace-header"]').text()).toContain("Home");
    expect(wrapper.get('[data-testid="vue-workspace-header"]').text()).toContain("New chat");
  });

  it("keeps the agents index wired to the new custom-agent route", async () => {
    const wrapper = await mountSuspended(AgentsIndexPage, { route: "/workspace/agents" });

    expect(wrapper.get('[data-testid="vue-workspace-nav-agents"]').classes()).toContain(
      "workspace-nav-shell__link--active",
    );
    expect(wrapper.get('[data-testid="vue-agents-new-link"]').attributes("href")).toBe(
      "/workspace/agents/new",
    );
  });

  it("marks settings active while account data loads through the Gateway auth contract", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));

    const wrapper = await mountSuspended(SettingsPage, { route: "/workspace/settings" });
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-workspace-nav-settings"]').classes()).toContain(
      "workspace-nav-shell__link--active",
    );
    expect(wrapper.get('[data-testid="vue-workspace-nav-settings"]').classes()).toContain(
      "workspace-nav-shell__link--active",
    );
    expect(wrapper.get('[data-testid="vue-workspace-nav-scheduled"]').attributes("href")).toBe(
      "/workspace/scheduled-tasks",
    );
  });

  it("persists collapsed and compact navigation states", async () => {
    const wrapper = await mountSuspended(WorkspaceIndexPage, { route: "/workspace" });
    const shell = wrapper.get(".workspace-nav-shell");

    await wrapper.get('[data-testid="vue-workspace-nav-collapse"]').trigger("click");
    await wrapper.get('[data-testid="vue-workspace-nav-density"]').trigger("click");
    await flushPromises();

    expect(shell.classes()).toContain("workspace-nav-shell--collapsed");
    expect(shell.classes()).toContain("workspace-nav-shell--compact");
    expect(wrapper.get('[data-testid="vue-workspace-nav-collapse"]').text()).toBe("展开");
    expect(wrapper.get('[data-testid="vue-workspace-nav-density"]').text()).toBe("舒适");
    expect(window.localStorage.getItem("deerflow.vue.workspace-nav.collapsed")).toBe("true");
    expect(window.localStorage.getItem("deerflow.vue.workspace-nav.density")).toBe("compact");
  });

  it("supports keyboard collapse for repeated navigation", async () => {
    const wrapper = await mountSuspended(WorkspaceIndexPage, { route: "/workspace" });
    const shell = wrapper.get(".workspace-nav-shell");

    window.dispatchEvent(new KeyboardEvent("keydown", { ctrlKey: true, key: "b" }));
    await flushPromises();

    expect(shell.classes()).toContain("workspace-nav-shell--collapsed");
    expect(wrapper.get('[data-testid="vue-workspace-nav-collapse"]').text()).toBe("展开");
  });

  it("keeps recent chat loading state distinct from an empty list", async () => {
    let resolveFetch: (response: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    const wrapper = await mountSuspended(ChatsIndexPage, { route: "/workspace/chats" });

    expect(wrapper.get('[data-testid="vue-workspace-recent-threads-loading"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="vue-workspace-recent-threads-loading"]').text()).toBe(
      "加载中",
    );
    expect(wrapper.text()).toContain("正在从 Gateway 加载最近对话。");
    expect(wrapper.find(".workspace-recent-threads__list").exists()).toBe(false);

    resolveFetch(Response.json([]));
    await flushPromises();
  });

  it("shows an explicit empty recent chats state after the Gateway search resolves empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));

    const wrapper = await mountSuspended(ChatsIndexPage, { route: "/workspace/chats" });
    await flushPromises();

    expect(wrapper.find('[data-testid="vue-workspace-recent-threads-loading"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="vue-workspace-recent-threads-empty"]').text()).toBe(
      "还没有最近对话。",
    );
    expect(wrapper.find(".workspace-recent-threads__list").exists()).toBe(false);
  });

  it("shows recent chat history affordances on the chats index", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (input === "/api/langgraph/threads/search") {
        return Response.json([
          thread("thread-a", "Alpha", "idle", {
            channel_source: { provider: "slack", type: "im_channel" },
          }),
          thread("thread-b", "Bravo", "interrupted", { deerflow_pinned: true }),
          thread("thread-c", "Charlie", "idle", {}, { agent_name: "writer" }),
          thread("thread-d", "Delta"),
          thread("thread-e", "Echo"),
          thread("thread-f", "Foxtrot"),
        ]);
      }
      return Response.json({ detail: "Unexpected request" }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = await mountSuspended(ChatsIndexPage, { route: "/workspace/chats" });
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-workspace-recent-threads"]').text()).toContain(
      "最近对话",
    );
    expect(wrapper.get('[data-testid="vue-workspace-recent-thread-thread-b"]').text()).toContain(
      "已置顶",
    );
    expect(wrapper.get('[data-testid="vue-workspace-recent-thread-thread-a"]').text()).toContain(
      "Slack",
    );
    expect(
      wrapper.get('[data-testid="vue-workspace-recent-thread-thread-c"] a').attributes("href"),
    ).toBe("/workspace/agents/writer/chats/thread-c");
    expect(wrapper.find('[data-testid="vue-workspace-recent-thread-thread-f"]').exists()).toBe(
      false,
    );
  });
});

function thread(
  threadId: string,
  title: string,
  status = "idle",
  metadata: Record<string, unknown> = {},
  context: Record<string, unknown> = {},
) {
  return {
    context,
    created_at: "2026-08-01T00:00:00Z",
    metadata,
    status,
    thread_id: threadId,
    updated_at: "2026-08-01T01:02:03Z",
    values: { title },
  };
}
