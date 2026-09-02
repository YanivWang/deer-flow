/*
  【文件职责】     守住输入框「打开新会话时光标已经在里面」这件事。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     ChatComposer.vue · AgentChat.vue
  【边界与注意】   **对照台账、几何、aria 三样都看不见这条差异**：`document.activeElement`
                   不进 aria 快照，也不是盒模型量（第八类差异）。wave 28 的 probe 量到
                   上游打开 /workspace/chats/new 之后焦点在 composer 的 textarea 上、
                   本仓在 body，靠的正是在 probe 里加一行 activeElement。

                   所以这一条只能由单测守：挂载后直接读 `document.activeElement`，
                   而且必须 `attachTo: document.body`——游离在文档外的元素 focus()
                   是 no-op，不挂上去这条用例会恒绿。
*/

import { readFileSync } from "node:fs";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import ChatComposer from "@/components/chat/ChatComposer.vue";
import { enUS } from "@/core/i18n/locales/en-US";

const mocks = vi.hoisted(() => ({
  loadSkills: vi.fn(),
  loadModels: vi.fn(),
  getUploadLimits: vi.fn(),
  uploadFiles: vi.fn(),
  polishInputDraft: vi.fn(),
  fetchWithAuth: vi.fn(),
}));

vi.mock("@/core/skills/api", () => ({ loadSkills: mocks.loadSkills }));
vi.mock("@/core/models/api", () => ({ loadModels: mocks.loadModels }));
vi.mock("@/core/uploads/api", () => ({
  getUploadLimits: mocks.getUploadLimits,
  uploadFiles: mocks.uploadFiles,
}));
vi.mock("@/core/input-polish/api", () => ({
  polishInputDraft: mocks.polishInputDraft,
}));
vi.mock("@/core/api/fetcher", () => ({ fetch: mocks.fetchWithAuth }));

/* 线索 121：没传的 Boolean prop 会被 Vue 变成 false，每一个都显式传上。 */
function mountComposer(props: Record<string, unknown>) {
  return mount(ChatComposer, {
    attachTo: document.body,
    props: {
      threadKey: "new",
      targetThreadId: "thread-1",
      userId: null,
      agentName: null,
      streaming: false,
      uploading: false,
      disabled: false,
      isWelcome: true,
      modelSelectionReady: true,
      showWelcomeSuggestions: true,
      promptHistory: [],
      context: {},
      submitMessage: vi.fn(async () => true),
      ...props,
    },
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false } },
            }),
          },
        ],
      ],
      stubs: { ReferenceAttachment: true, GoalStatus: true },
    },
  });
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  mocks.loadSkills.mockReset().mockResolvedValue([]);
  mocks.loadModels
    .mockReset()
    .mockResolvedValue({ models: [], token_usage: { enabled: false } });
  mocks.getUploadLimits.mockReset().mockResolvedValue(undefined);
  mocks.uploadFiles.mockReset();
  mocks.polishInputDraft.mockReset();
  mocks.fetchWithAuth.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("composer autoFocus", () => {
  it("focuses the textarea on mount, the way React's autoFocus does", () => {
    const wrapper = mountComposer({ autoFocus: true });
    expect(document.activeElement).toBe(wrapper.get("textarea").element);
    wrapper.unmount();
  });

  it("leaves focus alone when autoFocus is not asked for", () => {
    const wrapper = mountComposer({ autoFocus: false });
    expect(document.activeElement).not.toBe(wrapper.get("textarea").element);
    wrapper.unmount();
  });

  /*
    上游把 `autoFocus={isWelcomeMode}` 传给 InputBox，而 `isWelcomeMode` 的**初值**
    就是 `isNewThread`（chat-page.tsx:73 的 `useState(isNewThread)`），autoFocus 又只在
    挂载那一刻起作用——所以上游实际表达的是「挂载时这是不是一条新线程」。

    本仓的 `isWelcomeMode` 是个 computed（`visibleMessages.length === 0 &&
    !isHistoryLoading`），打开已有线程时会先真后假地抖一下。跟着它走会在上游根本不
    聚焦的屏上抢焦点，所以这里钉的是「传的是挂载那一刻的 initialRouteThreadId」，
    不是 isWelcomeMode。
  */
  it("is wired from the mount-time thread id, not the reactive welcome flag", () => {
    const source = readFileSync("app/components/chat/AgentChat.vue", "utf8");
    expect(source).toContain(':auto-focus="initialRouteThreadId === null"');
    expect(source).not.toContain(':auto-focus="isWelcomeMode"');
  });
});
