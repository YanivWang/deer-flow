import { mountSuspended, mockNuxtImport } from "@nuxt/test-utils/runtime";
import { flushPromises, type VueWrapper } from "@vue/test-utils";
import { useRouter } from "#app";
import { computed, ref, type ComputedRef, type Ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AgentChatPage from "../../../app/pages/workspace/agents/[agent_name]/chats/[thread_id].vue";
import ChatPage from "../../../app/pages/workspace/chats/[thread_id].vue";
import type { AgentThread, DeerFlowMessage, GoalState } from "../../../app/core/api/thread/types";
import {
  channelSourceOfThread,
  isThreadPinned,
  pathOfThread,
  titleOfThread,
} from "../../../app/core/api/thread/utils";

type ThreadListMock = ReturnType<typeof createThreadListMock>;
type HistoryMock = ReturnType<typeof createHistoryMock>;
type SendMessage = (options: {
  additionalKwargs?: Record<string, unknown>;
  context?: Record<string, unknown>;
  text: string;
  threadId: string;
}) => Promise<void>;
type StreamMock = {
  errorMessage: Ref<string | null>;
  isBusy: Ref<boolean>;
  isStreaming: Ref<boolean>;
  reset: ReturnType<typeof vi.fn>;
  sendMessage: SendMessage;
  setHistoryMessages: ReturnType<typeof vi.fn>;
  status: Ref<string>;
  stop: ReturnType<typeof vi.fn>;
  viewModel: ComputedRef<{
    cursor: string | null;
    gapCount: number;
    messageCount: number;
    messages: DeerFlowMessage[];
    runId: string | null;
    status: string;
    subtasks: unknown[];
  }>;
};
type CreateStreamMockOptions = Partial<Pick<StreamMock, "isBusy" | "isStreaming" | "sendMessage">> & {
  liveMessages?: Ref<DeerFlowMessage[]>;
  viewModel?: Partial<{
    cursor: string | null;
    gapCount: number;
    runId: string | null;
    status: string;
  }>;
};

const nuxtMocks = vi.hoisted(() => ({
  history: undefined as HistoryMock | undefined,
  stream: undefined as StreamMock | undefined,
  threadList: undefined as ThreadListMock | undefined,
}));

mockNuxtImport("useThreadHistory", () => () => {
  if (!nuxtMocks.history) {
    throw new Error("useThreadHistory mock was not configured.");
  }
  return nuxtMocks.history;
});
mockNuxtImport("useThreadList", () => () => {
  if (!nuxtMocks.threadList) {
    throw new Error("useThreadList mock was not configured.");
  }
  return nuxtMocks.threadList;
});
mockNuxtImport("useThreadStream", () => () => {
  if (!nuxtMocks.stream) {
    throw new Error("useThreadStream mock was not configured.");
  }
  return nuxtMocks.stream;
});

describe("workspace chat page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    nuxtMocks.history = createHistoryMock();
    nuxtMocks.stream = createStreamMock();
    nuxtMocks.threadList = createThreadListMock({
      hasMoreThreads: true,
      threads: [thread("thread-a", "Alpha"), thread("thread-b", "Beta")],
    });
  });

  it("marks the active route thread and renders its title", async () => {
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();

    expect(wrapper.get("h1").text()).toBe("Alpha");
    expect(wrapper.get(".workspace-nav-shell__skip").attributes("href")).toBe(
      "#workspace-chat-content",
    );
    expect(wrapper.get("#workspace-chat-content").attributes("tabindex")).toBe("-1");
    expect(wrapper.get('[data-testid="vue-thread-list-item-thread-a"]').classes()).toContain(
      "workspace-sidebar__item--active",
    );
    expect(wrapper.get('[data-testid="vue-thread-list-item-thread-a"]').classes()).toContain(
      "workspace-sidebar__item--active",
    );
    expect(wrapper.get('[data-testid="vue-thread-list-item-thread-b"]').classes()).not.toContain(
      "workspace-sidebar__item--active",
    );
  });

  it("routes New to a fresh workspace chat path", async () => {
    const router = useRouter();
    const pushSpy = vi.spyOn(router, "push").mockResolvedValue();
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await wrapper.get('[data-testid="vue-thread-create"]').trigger("click");

    expect(nuxtMocks.threadList?.createThread).toHaveBeenCalledTimes(1);
    expect(nuxtMocks.threadList?.createThread).toHaveBeenCalledWith({
      agentName: null,
      threadId: expect.stringMatching(/\S+/) as string,
    });
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0]?.[0]).toMatch(/^\/workspace\/chats\/[^/]+$/);
  });

  it("shows Gateway thread creation errors without navigating away", async () => {
    const router = useRouter();
    const pushSpy = vi.spyOn(router, "push").mockResolvedValue();
    const createThread = vi.fn(async () => {
      throw new Error("Failed to create thread");
    });
    nuxtMocks.threadList = createThreadListMock({
      createThread,
      createThreadErrorMessage: "Failed to create thread",
      hasMoreThreads: true,
      threads: [thread("thread-a", "Alpha")],
    });
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });

    await wrapper.get('[data-testid="vue-thread-create"]').trigger("click");
    await flushPromises();

    expect(createThread).toHaveBeenCalledTimes(1);
    expect(pushSpy).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="vue-thread-action-error"]').text()).toContain(
      "Failed to create thread",
    );
  });

  it("loads older chats from the sidebar action", async () => {
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await wrapper.get('[data-testid="vue-thread-list-load-more"]').trigger("click");

    expect(nuxtMocks.threadList?.loadMoreThreads).toHaveBeenCalledTimes(1);
  });

  it("renders loaded history and loads older history from the transcript action", async () => {
    nuxtMocks.history = createHistoryMock({
      hasMore: true,
      messages: [
        { id: "h-1", type: "human", content: "historical prompt" },
        { id: "a-1", type: "ai", content: "historical answer" },
      ],
    });
    nuxtMocks.stream = createStreamMock();

    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();

    expect(messageTexts(wrapper)).toEqual(["historical prompt", "historical answer"]);
    await wrapper.get(".workspace-chat__messages button").trigger("click");
    expect(nuxtMocks.history.loadMore).toHaveBeenCalledTimes(1);
  });

  it("overlays live stream messages on top of matching history without moving order", async () => {
    nuxtMocks.history = createHistoryMock({
      messages: [
        { id: "h-1", type: "human", content: "historical prompt" },
        { id: "a-1", type: "ai", content: "stale answer" },
      ],
    });
    nuxtMocks.stream = createStreamMock({
      liveMessages: ref([
        { id: "a-1", type: "ai", content: "updated answer" },
        { id: "a-2", type: "ai", content: "new answer" },
      ]),
    });

    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();

    expect(messageTexts(wrapper)).toEqual([
      "historical prompt",
      "updated answer",
      "new answer",
    ]);
    expect(wrapper.text()).not.toContain("stale answer");
  });

  it("submits human-input option responses as hidden replies", async () => {
    const sendMessage = vi.fn(async () => {});
    nuxtMocks.stream = createStreamMock({
      liveMessages: ref([
        {
          id: "tool-1",
          type: "tool",
          content: "Need clarification",
          artifact: {
            human_input: {
              version: 1,
              kind: "human_input_request",
              source: "ask_clarification",
              request_id: "request-1",
              question: "Choose an approach?",
              input_mode: "single_choice",
              options: [{ id: "option-1", label: "Fast", value: "fast" }],
            },
          },
        },
      ]),
      sendMessage,
    });

    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();

    await wrapper.get('[data-testid="vue-human-input-option-option-1"]').trigger("click");
    await flushPromises();

    expect(sendMessage).toHaveBeenCalledWith({
      additionalKwargs: {
        hide_from_ui: true,
        human_input_response: {
          version: 1,
          kind: "human_input_response",
          source: "ask_clarification",
          request_id: "request-1",
          response_kind: "option",
          option_id: "option-1",
          value: "fast",
        },
      },
      text: "关于“Choose an approach?”，我的回答是：fast",
      threadId: "thread-a",
    });
    expect(nuxtMocks.threadList?.query.refetch).toHaveBeenCalledTimes(1);
  });

  it("shows a stream replay gap warning while preserving run and cursor status", async () => {
    nuxtMocks.stream = createStreamMock({
      viewModel: {
        cursor: "120",
        gapCount: 1,
        runId: "run-1",
        status: "completed",
      },
    });

    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-stream-gap-warning"]').text()).toContain(
      "A stream replay gap was detected",
    );
    expect(wrapper.get('[data-testid="vue-thread-stream-status"]').text()).toContain("运行：run-1");
    expect(wrapper.get('[data-testid="vue-thread-stream-status"]').text()).toContain("游标：120");
    expect(wrapper.get('[data-testid="vue-thread-stream-status"]').text()).toContain("缺口：1");
    expect(wrapper.get('[data-testid="vue-thread-stream-status"]').attributes("role")).toBe(
      "status",
    );
    expect(wrapper.get('[data-testid="vue-stream-gap-warning"]').attributes("role")).toBe(
      "status",
    );
  });

  it("hides the stream replay gap warning when no gap has been observed", async () => {
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();

    expect(wrapper.find('[data-testid="vue-stream-gap-warning"]').exists()).toBe(false);
  });

  it("opens and persists the artifact panel for the active route", async () => {
    nuxtMocks.threadList = createThreadListMock({
      hasMoreThreads: true,
      threads: [
        thread("thread-a", "Alpha", {
          artifacts: ["/workspace/thread-a/report.md", "/workspace/thread-a/chart.png"],
        }),
      ],
    });

    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();

    await wrapper.get('[data-testid="artifact-trigger"]').trigger("click");
    await wrapper.get('[data-testid="vue-artifact-item-chart.png"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-artifact-panel"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="vue-artifact-item-chart.png"]').classes()).toContain(
      "workspace-artifacts__item--selected",
    );
    expect(wrapper.get('[data-testid="vue-artifact-selected"]').attributes("data-path")).toBe(
      "/workspace/thread-a/chart.png",
    );

    await wrapper.get('[data-testid="vue-artifact-detail-select"]').setValue(
      "/workspace/thread-a/report.md",
    );
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-artifact-selected-filename"]').text()).toBe(
      "report.md",
    );
    expect(wrapper.get('[data-testid="vue-artifact-selected"]').attributes("data-path")).toBe(
      "/workspace/thread-a/report.md",
    );
    await wrapper.get('[data-testid="vue-artifact-close"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="vue-artifact-panel-body"]').exists()).toBe(false);
    await wrapper.get('[data-testid="artifact-trigger"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-artifact-selected"]').attributes("data-path")).toBe(
      "/workspace/thread-a/report.md",
    );
    expect(window.sessionStorage.getItem(
      "deerflow:artifacts:v1:%2Fworkspace%2Fchats%2Fthread-a",
    )).toContain("/workspace/thread-a/report.md");
  });

  it("renders artifact preview, open, download, media/PDF/HTML, and fallback states", async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const createdHtmlBlobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      createdHtmlBlobs.push(blob);
      return `blob:artifact-html-preview-${createdHtmlBlobs.length}`;
    });
    const revokeObjectURL = vi.fn();
    const NativeURL = URL;
    vi.stubGlobal("URL", class extends NativeURL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/skills/install") {
        return Response.json({
          success: true,
          skill_name: "weather",
          message: "Skill weather installed.",
        });
      }
      if (String(input).endsWith("/index.html")) {
        return new Response([
          "<html><head>",
          "<link rel=\"stylesheet\" href=\"./app.css\">",
          "<style>.hero{background:url('./hero.png')}</style>",
          "</head><body><img src=\"images/chart.png\"></body></html>",
        ].join(""), {
          headers: { "content-type": "text/html" },
        });
      }
      if (String(input).endsWith("/app.css")) {
        return new Response(".hero{color:red}", {
          headers: { "content-type": "text/css" },
        });
      }
      if (String(input).endsWith("/hero.png") || String(input).endsWith("/images/chart.png")) {
        return new Response("fake image", {
          headers: { "content-type": "image/png" },
        });
      }
      return new Response("# Notes\n![Chart](chart.png)\nloaded from artifact");
    });
    vi.stubGlobal("fetch", fetchMock);
    nuxtMocks.threadList = createThreadListMock({
      hasMoreThreads: true,
      threads: [
        thread("thread-a", "Alpha", {
          artifacts: [
            "/workspace/thread-a/chart.png",
            "/workspace/thread-a/index.html",
            "/workspace/thread-a/report.pdf",
            "/workspace/thread-a/movie.mp4",
            "/workspace/thread-a/notes.md",
            "/workspace/thread-a/data.xlsx",
            "/workspace/thread-a/weather.skill",
          ],
        }),
      ],
    });

    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();

    await wrapper.get('[data-testid="artifact-trigger"]').trigger("click");
    await wrapper.get('[data-testid="vue-artifact-item-chart.png"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-artifact-selected-filename"]').text()).toBe(
      "chart.png",
    );
    expect(wrapper.get('[data-testid="vue-artifact-open"]').attributes("href")).toBe(
      "/api/threads/thread-a/artifacts/workspace/thread-a/chart.png",
    );
    expect(wrapper.get('[data-testid="vue-artifact-download"]').attributes("href")).toBe(
      "/api/threads/thread-a/artifacts/workspace/thread-a/chart.png?download=true",
    );
    expect(wrapper.get('[data-testid="vue-artifact-download"]').attributes("download")).toBe(
      "chart.png",
    );
    await wrapper.get('[data-testid="vue-artifact-copy"]').trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(
      "/api/threads/thread-a/artifacts/workspace/thread-a/chart.png",
    );
    expect(wrapper.get('[data-testid="vue-artifact-copy-status"]').text()).toBe(
      "产物链接已复制。",
    );
    expect(wrapper.get('[data-testid="vue-artifact-copy-status"]').attributes("role")).toBe(
      "status",
    );
    expect(wrapper.get('[data-testid="vue-artifact-preview"]').find("img").attributes("src")).toBe(
      "/api/threads/thread-a/artifacts/workspace/thread-a/chart.png",
    );
    expect(wrapper.get('[data-testid="vue-artifact-preview-description"]').text()).toContain(
      "已认证的产物路由",
    );

    await wrapper.get('[data-testid="vue-artifact-item-index.html"]').trigger("click");
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/threads/thread-a/artifacts/workspace/thread-a/index.html",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      }),
    );
    expect(wrapper.get('[data-testid="vue-artifact-html-blob-preview"]').attributes("src")).toBe(
      "blob:artifact-html-preview-1",
    );
    expect(wrapper.get('[data-testid="vue-artifact-html-blob-preview"]').attributes("sandbox")).toBe(
      "allow-scripts allow-forms",
    );
    expect(wrapper.get('[data-testid="vue-artifact-view-preview"]').classes()).toContain(
      "workspace-button--active",
    );
    expect(wrapper.get('[data-testid="vue-artifact-view-code"]').classes()).not.toContain(
      "workspace-button--active",
    );
    await expect(createdHtmlBlobs[0]?.text()).resolves.toContain("href=\"data:text/css");
    await expect(createdHtmlBlobs[0]?.text()).resolves.toContain("url(data:image/png");
    await expect(createdHtmlBlobs[0]?.text()).resolves.toContain("src=\"data:image/png");
    await expect(createdHtmlBlobs[0]?.text()).resolves.toContain(
      "data-deerflow-artifact-scroll-restoration",
    );
    expect(wrapper.get('[data-testid="vue-artifact-preview-description"]').text()).toContain(
      "沙箱 blob",
    );
    expect(wrapper.get('[data-testid="vue-artifact-preview-fallback"]').text()).toContain(
      "打开或下载此产物",
    );
    await wrapper.get('[data-testid="vue-artifact-view-code"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-artifact-view-preview"]').classes()).not.toContain(
      "workspace-button--active",
    );
    expect(wrapper.get('[data-testid="vue-artifact-view-code"]').classes()).toContain(
      "workspace-button--active",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/threads/thread-a/artifacts/workspace/thread-a/index.html",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      }),
    );
    expect(wrapper.get('[data-testid="vue-artifact-code-language"]').text()).toBe("html");
    expect(wrapper.get('[data-testid="vue-artifact-codemirror"]').attributes("role")).toBe(
      "region",
    );
    expect(wrapper.get('[data-testid="vue-artifact-codemirror"]').text()).toContain(
      "<html>",
    );
    await wrapper.get('[data-testid="vue-artifact-view-preview"]').trigger("click");
    await flushPromises();

    await wrapper.get('[data-testid="vue-artifact-item-report.pdf"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-artifact-preview"]').find("iframe").attributes("src")).toBe(
      "/api/threads/thread-a/artifacts/workspace/thread-a/report.pdf",
    );
    expect(wrapper.get('[data-testid="vue-artifact-preview-description"]').text()).toContain(
      "PDF 预览已沙箱隔离",
    );
    expect(wrapper.get('[data-testid="vue-artifact-preview-fallback"]').text()).toContain(
      "打开或下载此产物",
    );

    await wrapper.get('[data-testid="vue-artifact-item-movie.mp4"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-artifact-preview"]').find("video").attributes("src")).toBe(
      "/api/threads/thread-a/artifacts/workspace/thread-a/movie.mp4",
    );
    expect(wrapper.get('[data-testid="vue-artifact-preview-description"]').text()).toContain(
      "视频预览使用浏览器控件",
    );
    expect(wrapper.get('[data-testid="vue-artifact-preview-fallback"]').text()).toContain(
      "打开或下载此产物",
    );

    await wrapper.get('[data-testid="vue-artifact-item-notes.md"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="vue-artifact-copy-status"]').exists()).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/threads/thread-a/artifacts/workspace/thread-a/notes.md",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      }),
    );
    expect(wrapper.get('[data-testid="vue-artifact-markdown-preview"]').text()).toContain(
      "loaded from artifact",
    );
    expect(
      wrapper.get('[data-testid="vue-artifact-markdown-preview"] img').attributes("src"),
    ).toBe("/api/threads/thread-a/artifacts/workspace/thread-a/chart.png");
    await wrapper.get('[data-testid="vue-artifact-view-code"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-artifact-code-preview"]').text()).toContain(
      "loaded from artifact",
    );
    expect(wrapper.get('[data-testid="vue-artifact-code-language"]').text()).toBe("markdown");
    expect(wrapper.get('[data-testid="vue-artifact-code-line-count"]').text()).toBe("3 行");
    await wrapper.get('[data-testid="vue-artifact-copy-code"]').trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenLastCalledWith("# Notes\n![Chart](chart.png)\nloaded from artifact");
    expect(wrapper.get('[data-testid="vue-artifact-copy-code-status"]').text()).toBe(
      "产物源码已复制。",
    );
    expect(wrapper.get('[data-testid="vue-artifact-copy-code-status"]').attributes("role")).toBe(
      "status",
    );

    await wrapper.get('[data-testid="vue-artifact-item-data.xlsx"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="vue-artifact-preview"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="vue-artifact-download-fallback"]').text()).toContain(
      "Excel file",
    );

    await wrapper.get('[data-testid="vue-artifact-item-weather.skill"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="vue-artifact-install-skill"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/skills/install",
      expect.objectContaining({
        body: JSON.stringify({
          path: "/workspace/thread-a/weather.skill",
          thread_id: "thread-a",
        }),
        method: "POST",
      }),
    );
    expect(wrapper.get('[data-testid="vue-artifact-install-skill-status"]').text()).toBe(
      "Skill weather installed.",
    );
    expect(wrapper.get('[data-testid="vue-artifact-install-skill-status"]').attributes("role")).toBe(
      "status",
    );
  });

  it("shows artifact code loading and error states without reusing another file's content", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    nuxtMocks.threadList = createThreadListMock({
      hasMoreThreads: true,
      threads: [
        thread("thread-a", "Alpha", {
          artifacts: [
            "/workspace/thread-a/first.ts",
            "/workspace/thread-a/second.ts",
          ],
        }),
      ],
    });

    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();

    await wrapper.get('[data-testid="artifact-trigger"]').trigger("click");
    await wrapper.get('[data-testid="vue-artifact-item-first.ts"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-artifact-code-loading"]').text()).toContain(
      "first.ts",
    );
    expect(wrapper.get('[data-testid="vue-artifact-code-loading"]').attributes("role")).toBe(
      "status",
    );
    await vi.waitFor(() => expect(resolvers.length).toBeGreaterThan(0));
    resolvers.at(-1)?.(new Response("first content"));
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-artifact-code-preview"]').text()).toContain(
      "first content",
    );

    await wrapper.get('[data-testid="vue-artifact-item-second.ts"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-artifact-code-preview"]').text()).not.toContain(
      "first content",
    );
    await vi.waitFor(() => expect(resolvers.length).toBeGreaterThan(1));
    resolvers.at(-1)?.(new Response("Missing artifact", { status: 404 }));
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-artifact-code-error"]').text()).toContain(
      "Missing artifact",
    );
    expect(wrapper.get('[data-testid="vue-artifact-code-error"]').attributes("role")).toBe(
      "alert",
    );
  });

  it("keeps artifact panel state isolated across route changes", async () => {
    nuxtMocks.threadList = createThreadListMock({
      hasMoreThreads: true,
      threads: [
        thread("thread-a", "Alpha", { artifacts: ["/workspace/thread-a/report.md"] }),
        thread("thread-b", "Beta"),
      ],
    });
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();

    await wrapper.get('[data-testid="artifact-trigger"]').trigger("click");
    await wrapper.get('[data-testid="vue-artifact-item-report.md"]').trigger("click");
    await flushPromises();
    await wrapper.vm.$router.push("/workspace/chats/thread-b");
    await flushPromises();

    expect(wrapper.find('[data-testid="vue-artifact-panel-body"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="artifact-trigger"]').attributes("disabled")).toBeDefined();
    expect(wrapper.text()).not.toContain("/workspace/thread-a/report.md");
  });

  it("renders active goal state from the current thread", async () => {
    nuxtMocks.threadList = createThreadListMock({
      hasMoreThreads: true,
      threads: [
        thread("thread-a", "Alpha", {
          goal: goal("Finish Vue parity", { continuation_count: 2 }),
        }),
      ],
    });

    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-goal-objective"]').text()).toBe("Finish Vue parity");
    expect(wrapper.get('[data-testid="vue-goal-continuation"]').text()).toBe("Continuing 2/8");
  });

  it("sets and clears goal state through the goal API", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ goal: goal("New goal") }))
      .mockResolvedValueOnce(Response.json({ goal: null }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();

    await wrapper.get('[data-testid="vue-goal-input"]').setValue(" New goal ");
    await wrapper.get("form.workspace-goal__form").trigger("submit");
    await flushPromises();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/threads/thread-a/goal");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ objective: "New goal" }),
        method: "PUT",
      }),
    );
    expect(wrapper.get('[data-testid="vue-goal-objective"]').text()).toBe("New goal");
    expect(nuxtMocks.threadList?.query.refetch).toHaveBeenCalledTimes(1);

    await wrapper.get('[data-testid="vue-goal-clear"]').trigger("click");
    await flushPromises();

    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: "DELETE" }));
    expect(wrapper.text()).toContain("No active goal.");
    expect(nuxtMocks.threadList?.query.refetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the composer disabled while a stream action is busy", async () => {
    nuxtMocks.stream = createStreamMock({ isBusy: true, isStreaming: false });

    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await wrapper.get('[data-testid="vue-chat-input"]').setValue("hello");
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-chat-send"]').attributes("disabled")).toBeDefined();
  });

  it("clears whitespace-only composer input without sending or refetching", async () => {
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await wrapper.get('[data-testid="vue-chat-input"]').setValue("   ");

    await wrapper.get("form.workspace-chat__composer").trigger("submit");
    await flushPromises();

    expect(nuxtMocks.stream?.sendMessage).not.toHaveBeenCalled();
    expect(nuxtMocks.threadList?.query.refetch).not.toHaveBeenCalled();
    expect((wrapper.get('[data-testid="vue-chat-input"]').element as HTMLTextAreaElement).value).toBe("");
  });

  it("sends trimmed composer text, clears the draft, and refetches the thread list", async () => {
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await wrapper.get('[data-testid="vue-chat-input"]').setValue("  hello DeerFlow  ");

    await wrapper.get("form.workspace-chat__composer").trigger("submit");
    await flushPromises();

    expect(nuxtMocks.stream?.sendMessage).toHaveBeenCalledWith({
      text: "hello DeerFlow",
      threadId: "thread-a",
    });
    expect(nuxtMocks.threadList?.query.refetch).toHaveBeenCalledTimes(1);
    expect((wrapper.get('[data-testid="vue-chat-input"]').element as HTMLTextAreaElement).value).toBe("");
  });

  it("persists local thread settings and sends allowed context fields with the next run", async () => {
    nuxtMocks.threadList = createThreadListMock({
      hasMoreThreads: true,
      threads: [thread("thread-a", "Alpha", {}, { agent_name: "server-agent" })],
    });
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();

    await wrapper.get('[data-testid="vue-thread-settings-model"]').setValue("local-model");
    await wrapper.get('[data-testid="vue-thread-settings-mode"]').setValue("pro");
    await wrapper.get('[data-testid="vue-thread-settings-reasoning"]').setValue("high");
    await wrapper.get('[data-testid="vue-thread-settings-thinking"]').setValue(true);
    await wrapper.get('[data-testid="vue-thread-settings-subagent"]').setValue(true);
    await wrapper.get('[data-testid="vue-chat-input"]').setValue("with settings");
    await wrapper.get("form.workspace-chat__composer").trigger("submit");
    await flushPromises();

    expect(window.localStorage.getItem("deerflow.thread-model.thread-a")).toBe("local-model");
    expect(nuxtMocks.stream?.sendMessage).toHaveBeenCalledWith({
      context: {
        agent_name: "server-agent",
        model_name: "local-model",
        mode: "pro",
        reasoning_effort: "high",
        thinking_enabled: true,
        subagent_enabled: true,
      },
      text: "with settings",
      threadId: "thread-a",
    });
  });

  it("restores the composer draft and skips refetch when send fails", async () => {
    const sendMessage = vi.fn(async () => {
      throw new Error("stream failed");
    });
    nuxtMocks.stream = createStreamMock({ sendMessage });
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await wrapper.get('[data-testid="vue-chat-input"]').setValue("  keep me  ");

    await wrapper.get("form.workspace-chat__composer").trigger("submit");
    await flushPromises();

    expect(sendMessage).toHaveBeenCalledWith({ text: "keep me", threadId: "thread-a" });
    expect(nuxtMocks.threadList?.query.refetch).not.toHaveBeenCalled();
    expect((wrapper.get('[data-testid="vue-chat-input"]').element as HTMLTextAreaElement).value).toBe(
      "keep me",
    );
  });

  it("stops the active stream and refetches history plus the thread list", async () => {
    nuxtMocks.stream = createStreamMock({ isBusy: true, isStreaming: true });
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });

    await wrapper.get('[data-testid="vue-chat-stop"]').trigger("click");
    await flushPromises();

    expect(nuxtMocks.stream.stop).toHaveBeenCalledTimes(1);
    expect(nuxtMocks.history?.query.refetch).toHaveBeenCalledTimes(1);
    expect(nuxtMocks.threadList?.query.refetch).toHaveBeenCalledTimes(1);
  });

  it("disables compact for empty or busy threads", async () => {
    const emptyWrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();
    expect(emptyWrapper.get('[data-testid="vue-chat-compact"]').attributes("disabled")).toBeDefined();

    nuxtMocks.history = createHistoryMock({
      messages: [{ id: "h-1", type: "human", content: "has context" }],
    });
    nuxtMocks.stream = createStreamMock({ isBusy: true, isStreaming: true });
    const busyWrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();
    expect(busyWrapper.get('[data-testid="vue-chat-compact"]').attributes("disabled")).toBeDefined();
  });

  it("compacts active thread context and refetches history plus thread list", async () => {
    nuxtMocks.history = createHistoryMock({
      messages: [{ id: "h-1", type: "human", content: "has context" }],
    });
    nuxtMocks.threadList = createThreadListMock({
      hasMoreThreads: true,
      threads: [
        thread("thread-a", "Alpha", {}, { agent_name: "researcher", model_name: "model-a" }),
      ],
    });
    const fetchMock = vi.fn(async () =>
      Response.json({
        thread_id: "thread-a",
        compacted: true,
        reason: null,
        removed_message_count: 8,
        preserved_message_count: 4,
        summary_updated: true,
        checkpoint_id: "checkpoint-1",
        total_tokens: 512,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await flushPromises();

    await wrapper.get('[data-testid="vue-chat-compact"]').trigger("click");
    await flushPromises();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/threads/thread-a/compact");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          force: true,
          agent_name: "researcher",
          model_name: "model-a",
        }),
        method: "POST",
      }),
    );
    expect(wrapper.get('[data-testid="vue-compact-notice"]').text()).toContain(
      "较早上下文已压缩。",
    );
    expect(nuxtMocks.history.query.refetch).toHaveBeenCalledTimes(1);
    expect(nuxtMocks.threadList?.query.refetch).toHaveBeenCalledTimes(1);
  });

  it("routes away to a fresh chat path after deleting the active thread", async () => {
    const router = useRouter();
    const pushSpy = vi.spyOn(router, "push").mockResolvedValue();
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });

    await wrapper.get('[data-testid="vue-thread-delete-thread-a"]').trigger("click");
    await flushPromises();

    expect(nuxtMocks.threadList?.deleteThread).toHaveBeenCalledWith({ threadId: "thread-a" });
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0]?.[0]).toMatch(/^\/workspace\/chats\/[^/]+$/);
    expect(pushSpy.mock.calls[0]?.[0]).not.toBe("/workspace/chats/thread-a");
  });

  it("does not navigate after deleting an inactive thread", async () => {
    const router = useRouter();
    const pushSpy = vi.spyOn(router, "push").mockResolvedValue();
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });

    await wrapper.get('[data-testid="vue-thread-delete-thread-b"]').trigger("click");
    await flushPromises();

    expect(nuxtMocks.threadList?.deleteThread).toHaveBeenCalledWith({ threadId: "thread-b" });
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("shows rename errors without clearing the draft", async () => {
    const renameThread = vi.fn(async () => {
      throw new Error("Thread has an active run.");
    });
    nuxtMocks.threadList = createThreadListMock({
      hasMoreThreads: true,
      renameThread,
      threads: [thread("thread-a", "Alpha")],
    });
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await wrapper.get('[data-testid="vue-thread-rename-input"]').setValue("Blocked title");

    await wrapper.get("form.workspace-chat__rename").trigger("submit");
    await flushPromises();

    expect(renameThread).toHaveBeenCalledWith({ threadId: "thread-a", title: "Blocked title" });
    expect(wrapper.get('[data-testid="vue-thread-rename-error"]').text()).toContain(
      "Thread has an active run.",
    );
    expect(wrapper.get('[data-testid="vue-thread-rename-error"]').attributes("role")).toBe(
      "alert",
    );
    expect(
      (wrapper.get('[data-testid="vue-thread-rename-input"]').element as HTMLInputElement).value,
    ).toBe("Blocked title");
  });

  it("clears rename draft and previous errors after a successful rename", async () => {
    const renameThread = vi
      .fn<[{ threadId: string; title: string }], Promise<void>>()
      .mockRejectedValueOnce(new Error("Thread has an active run."))
      .mockResolvedValueOnce();
    nuxtMocks.threadList = createThreadListMock({
      hasMoreThreads: true,
      renameThread,
      threads: [thread("thread-a", "Alpha")],
    });
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await wrapper.get('[data-testid="vue-thread-rename-input"]').setValue("Recovered title");
    await wrapper.get("form.workspace-chat__rename").trigger("submit");
    await flushPromises();
    expect(wrapper.find('[data-testid="vue-thread-rename-error"]').exists()).toBe(true);

    await wrapper.get("form.workspace-chat__rename").trigger("submit");
    await flushPromises();

    expect(renameThread).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[data-testid="vue-thread-rename-error"]').exists()).toBe(false);
    expect(
      (wrapper.get('[data-testid="vue-thread-rename-input"]').element as HTMLInputElement).value,
    ).toBe("");
  });

  it("disables duplicate mutation actions and shows sidebar mutation errors", async () => {
    nuxtMocks.threadList = createThreadListMock({
      deleteThreadErrorMessage: "Delete failed.",
      hasMoreThreads: true,
      isCreatingThread: true,
      isDeletingThread: true,
      isPinningThread: true,
      isRenamingThread: true,
      threads: [thread("thread-a", "Alpha")],
    });
    const wrapper = await mountSuspended(ChatPage, { route: "/workspace/chats/thread-a" });
    await wrapper.get('[data-testid="vue-thread-rename-input"]').setValue("Rename while busy");

    expect(wrapper.get('[data-testid="vue-thread-action-error"]').text()).toContain(
      "Delete failed.",
    );
    expect(wrapper.get('[data-testid="vue-thread-action-error"]').attributes("role")).toBe(
      "alert",
    );
    expect(wrapper.get('[data-testid="vue-thread-create"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="vue-thread-pin-thread-a"]').attributes("disabled")).toBeDefined();
    expect(
      wrapper.get('[data-testid="vue-thread-delete-thread-a"]').attributes("disabled"),
    ).toBeDefined();
    expect(wrapper.get('[data-testid="vue-thread-rename-submit"]').attributes("disabled")).toBeDefined();
  });

  it("passes route agent context when sending from the agent chat route", async () => {
    const wrapper = await mountSuspended(AgentChatPage, {
      route: "/workspace/agents/research%20agent/chats/thread-a",
    });
    await wrapper.get('[data-testid="vue-chat-input"]').setValue("agent task");

    await wrapper.get("form.workspace-chat__composer").trigger("submit");
    await flushPromises();

    expect(nuxtMocks.stream?.sendMessage).toHaveBeenCalledWith({
      context: { agent_name: "research agent" },
      text: "agent task",
      threadId: "thread-a",
    });
  });

  it("keeps fresh chat routing inside the active agent route namespace", async () => {
    const router = useRouter();
    const pushSpy = vi.spyOn(router, "push").mockResolvedValue();
    const wrapper = await mountSuspended(AgentChatPage, {
      route: "/workspace/agents/research%20agent/chats/thread-a",
    });

    await wrapper.get('[data-testid="vue-thread-create"]').trigger("click");

    expect(nuxtMocks.threadList?.createThread).toHaveBeenCalledWith({
      agentName: "research agent",
      threadId: expect.stringMatching(/\S+/) as string,
    });
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0]?.[0]).toMatch(
      /^\/workspace\/agents\/research%20agent\/chats\/[^/]+$/,
    );
  });
});

function createThreadListMock({
  createThread,
  createThreadErrorMessage = null,
  deleteThreadErrorMessage = null,
  hasMoreThreads,
  isCreatingThread = false,
  isDeletingThread = false,
  isPinningThread = false,
  isRenamingThread = false,
  pinThreadErrorMessage = null,
  renameThread = vi.fn(async () => {}),
  renameThreadErrorMessage = null,
  threads,
}: {
  createThread?: (options: { agentName?: string | null; threadId?: string }) => Promise<AgentThread>;
  createThreadErrorMessage?: string | null;
  deleteThreadErrorMessage?: string | null;
  hasMoreThreads: boolean;
  isCreatingThread?: boolean;
  isDeletingThread?: boolean;
  isPinningThread?: boolean;
  isRenamingThread?: boolean;
  pinThreadErrorMessage?: string | null;
  renameThread?: (options: { threadId: string; title: string }) => Promise<void>;
  renameThreadErrorMessage?: string | null;
  threads: AgentThread[];
}) {
  return {
    channelSourceOfThread,
    createThread: createThread ?? vi.fn(async ({ agentName, threadId = "fresh-thread" }) =>
      thread(
        threadId,
        "Untitled",
        {},
        agentName ? { agent_name: agentName } : {},
      ),
    ),
    createThreadErrorMessage: ref(createThreadErrorMessage),
    deleteThread: vi.fn(async () => {}),
    deleteThreadErrorMessage: ref(deleteThreadErrorMessage),
    hasMoreThreads: ref(hasMoreThreads),
    isCreatingThread: ref(isCreatingThread),
    isDeletingThread: ref(isDeletingThread),
    isLoadingMoreThreads: ref(false),
    isPinningThread: ref(isPinningThread),
    isRenamingThread: ref(isRenamingThread),
    isThreadPinned,
    loadMoreThreads: vi.fn(async () => {}),
    pathOfThread,
    pinThreadErrorMessage: ref(pinThreadErrorMessage),
    pinThread: vi.fn(async () => {}),
    query: {
      isFetching: ref(false),
      isLoading: ref(false),
      isSuccess: ref(true),
      refetch: vi.fn(async () => {}),
    },
    renameThreadErrorMessage: ref(renameThreadErrorMessage),
    renameThread,
    threads: ref(threads),
    titleOfThread,
  };
}

function createHistoryMock({
  hasMore = false,
  isLoading = false,
  messages = [],
}: {
  hasMore?: boolean;
  isLoading?: boolean;
  messages?: DeerFlowMessage[];
} = {}) {
  return {
    hasMore: ref(hasMore),
    isLoading: ref(isLoading),
    loadMore: vi.fn(async () => {}),
    messages: ref<DeerFlowMessage[]>(messages),
    query: {
      refetch: vi.fn(async () => {}),
    },
  };
}

function createStreamMock(
  overrides: CreateStreamMockOptions = {},
): StreamMock {
  const historyMessages = ref<DeerFlowMessage[]>([]);
  const liveMessages = overrides.liveMessages ?? ref<DeerFlowMessage[]>([]);
  const setHistoryMessages = vi.fn((messages: DeerFlowMessage[]) => {
    historyMessages.value = messages;
  });
  return {
    errorMessage: ref<string | null>(null),
    isBusy: overrides.isBusy ?? ref(false),
    isStreaming: overrides.isStreaming ?? ref(false),
    reset: vi.fn(),
    sendMessage: overrides.sendMessage ?? vi.fn(async () => {}),
    setHistoryMessages,
    status: ref("idle"),
    stop: vi.fn(async () => {}),
    viewModel: computed(() => ({
      cursor: overrides.viewModel?.cursor ?? null,
      gapCount: overrides.viewModel?.gapCount ?? 0,
      messageCount: mergeMessagesById(historyMessages.value, liveMessages.value).length,
      messages: mergeMessagesById(historyMessages.value, liveMessages.value),
      runId: overrides.viewModel?.runId ?? null,
      status: overrides.viewModel?.status ?? "idle",
      subtasks: [],
    })),
  };
}

function mergeMessagesById(
  historyMessages: DeerFlowMessage[],
  liveMessages: DeerFlowMessage[],
): DeerFlowMessage[] {
  const merged: DeerFlowMessage[] = [];
  const indexById = new Map<string, number>();
  for (const message of [...historyMessages, ...liveMessages]) {
    const id = message.id;
    if (!id) {
      merged.push(message);
      continue;
    }
    const existingIndex = indexById.get(id);
    if (existingIndex === undefined) {
      indexById.set(id, merged.length);
      merged.push(message);
    } else {
      merged[existingIndex] = message;
    }
  }
  return merged;
}

function messageTexts(wrapper: VueWrapper): string[] {
  return wrapper
    .findAll(".message-list__content")
    .map((message) => message.text());
}

function thread(
  id: string,
  title: string,
  values: Partial<AgentThread["values"]> = {},
  context: AgentThread["context"] = {},
): AgentThread {
  return {
    context,
    created_at: "2026-07-31T00:00:00Z",
    metadata: {},
    status: "idle",
    thread_id: id,
    updated_at: "2026-07-31T00:00:00Z",
    values: { ...values, title },
  };
}

function goal(
  objective: string,
  overrides: Partial<GoalState> = {},
): GoalState {
  return {
    objective,
    status: "active",
    created_at: "2026-07-31T00:00:00Z",
    updated_at: "2026-07-31T00:00:00Z",
    continuation_count: 0,
    max_continuations: 8,
    no_progress_count: 0,
    max_no_progress_continuations: 2,
    ...overrides,
  };
}
