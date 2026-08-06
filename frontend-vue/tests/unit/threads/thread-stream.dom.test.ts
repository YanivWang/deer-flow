/*
  【文件职责】     `useThreadStream` 的生命周期：C8/C9 顺序锚点、A7 清空、A8 失效。
  【对应 frontend/】 tests/unit/core/threads/local-turn-order.dom.test.tsx（110 行）
  【架构位置】     L3 测试（dom project）
  【主要导出】     无
  【依赖关系】     app/composables/useThreadStream.ts · @tanstack/vue-query
  【边界与注意】   **每一条断言都是成功态的正面特征，不是「没崩」。** M3 的教训：
                   有回退路径的地方，只断言「文本还在」就是假绿。这里对应的
                   三个回退形状分别是——顺序没被恢复（消息仍在原位也「有内容」）、
                   A7 没清空（旧乐观消息仍在也「能显示」）、A8 只失效一次
                   （标题最终也会对，只是晚 30 秒）。所以断言的是
                   **顺序数组本身、清空后的长度、以及两轮失效的 key 集合**。

                   上游那份用 `rs.mock("@langchain/langgraph-sdk/react")` 换掉
                   `useStream`。这里换的是 `runnerFactory`——它是**生产代码本来
                   就有的注入点**，不是测试专用的 mock 层。差别在于：mock 模块
                   时被替换的是一整个包，测试与生产的代码路径就此分叉；
                   注入 factory 时分叉只有一处，且那一处在类型上是同一个接口。
*/

import type { AgentSnapshot } from "@deerflow/agent-core";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";

import { STREAM_RENDER_COALESCE_MS } from "@/core/threads/coalesce";

import type {
  ThreadRunner,
  ThreadRunnerOptions,
} from "@/core/agent-deerflow/thread-runner";
import type { Message } from "@/core/types/message";

import { useThreadStream } from "@/composables/useThreadStream";

// `useThreadHistory` 真的会发请求。这里给一个空历史，让被测对象只剩实时那一路。
vi.mock("@/composables/useThreadHistory", () => ({
  useThreadHistory: () => ({
    messages: ref<Message[]>([]),
    loading: ref(false),
    hasMore: ref(false),
    loadMore: () => Promise.resolve(),
    error: ref(null),
  }),
}));

interface FakeRunner extends ThreadRunner {
  emitCustom(data: unknown): void;
  setMessages(messages: Message[]): void;
  settle(status: "completed" | "cancelled"): void;
}

function createFakeRunner(options: ThreadRunnerOptions): FakeRunner {
  let messages: Message[] = [];
  let status = "idle";
  const snapshot = {
    state: {},
    messageIds: [],
    messages: {},
    session: { status: "idle" },
    lastActivityAt: 0,
  } as unknown as AgentSnapshot<Record<string, unknown>>;

  return {
    getSnapshot: () => snapshot,
    getWireMessages: () => messages,
    getSessionState: () => ({ status }) as never,
    isStreaming: () => status === "streaming",
    subscribe: () => () => {},
    async submit(input) {
      status = "streaming";
      options.onStart?.({ threadId: input.threadId, runId: "run-1" });
      options.onSnapshot?.();
    },
    stop() {
      status = "cancelled";
    },
    abort() {},
    reset() {},
    flushNotifications() {},
    emitCustom: (data) => options.onCustomEvent?.(data),
    setMessages(next) {
      messages = next;
      options.onSnapshot?.();
    },
    settle(next) {
      status = next;
      options.onSettled?.({ status: next } as never);
    },
  };
}

function mountStream() {
  let fake: FakeRunner | undefined;
  let api: ReturnType<typeof useThreadStream> | undefined;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidated: unknown[][] = [];
  const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);
  queryClient.invalidateQueries = ((filters?: { queryKey?: unknown[] }) => {
    if (filters?.queryKey) invalidated.push(filters.queryKey);
    return originalInvalidate(filters as never);
  }) as typeof queryClient.invalidateQueries;

  const Component = defineComponent({
    setup() {
      api = useThreadStream({
        threadId: ref("thread-1"),
        context: ref({ mode: "flash" }),
        notify: { warn: (key) => warnings.push(key), error: () => {} },
        runnerFactory: (options) => {
          fake = createFakeRunner(options);
          return fake;
        },
      });
      return () => h("div");
    },
  });
  const warnings: string[] = [];

  const wrapper = mount(Component, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  });
  return {
    wrapper,
    get fake() {
      return fake!;
    },
    get api() {
      return api!;
    },
    warnings,
    invalidated,
    queryClient,
  };
}

/**
 * 等到合帧层把最新数组发出来。
 *
 * **这一步是必需的，不是测试样板。** `useCoalescedStreamMessages` 的前沿 flush
 * 发生在「开始流式」那一刻，那时消息还是空的；随后的第一个 chunk 落在尾部
 * flush 上，最多晚一个 interval（80ms）。M3 那条教训在这里的形态是：
 * 只 `await flushPromises()` 一次就断言，拿到的是**前沿那一帧的空数组**——
 * 用例会红得莫名其妙，或者（如果断言写成「包含某条消息」）永远绿不了。
 */
async function settleCoalescing() {
  await vi.advanceTimersByTimeAsync(STREAM_RENDER_COALESCE_MS + 1);
  await flushPromises();
}

const earlyAssistantStep = {
  id: "early-assistant-step",
  type: "ai",
  content: "Reading the presentation skill",
} as Message;
const injectedHuman = {
  id: "current-request__user",
  type: "human",
  content: "Build a presentation",
} as Message;

describe("useThreadStream · C8/C9 本地回合顺序锚点", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("把先于 human 到达的 AI 步骤移到 human 之后，并在 finish 之后保持", async () => {
    const ctx = mountStream();

    await ctx.api.sendMessage("thread-1", { text: "Build a presentation" });
    await flushPromises();

    // 协议顺序：AI 步骤先到，human 后到（messages-tuple 先于 values）。
    ctx.fake.setMessages([earlyAssistantStep, injectedHuman]);
    await settleCoalescing();

    // 正面特征：**顺序数组本身**。只断言「两条都在」的话，没恢复顺序也会绿。
    expect(ctx.api.messages.value.map((m) => m.id)).toEqual([
      injectedHuman.id,
      earlyAssistantStep.id,
    ]);

    ctx.fake.settle("completed");
    await settleCoalescing();

    // C9：基线保持到 finish 之后。清早了这里就会退回协议顺序。
    expect(ctx.api.messages.value.map((m) => m.id)).toEqual([
      injectedHuman.id,
      earlyAssistantStep.id,
    ]);
    ctx.wrapper.unmount();
  });

  it("没有本地提交时不动协议顺序（基线为 null，不是空 set）", async () => {
    const ctx = mountStream();
    vi.useRealTimers();
    vi.useFakeTimers();
    // 直接灌消息，不经过 sendMessage —— 重连 / 别的客户端起的 run 就是这个形状。
    ctx.fake.setMessages([earlyAssistantStep, injectedHuman]);
    await settleCoalescing();

    expect(ctx.api.messages.value.map((m) => m.id)).toEqual([
      earlyAssistantStep.id,
      injectedHuman.id,
    ]);
    ctx.wrapper.unmount();
  });
});

describe("useThreadStream · A7 gap 恢复", () => {
  it("清空乐观消息、失效缓存、发出本地化恢复警告", async () => {
    const ctx = mountStream();
    await ctx.api.sendMessage("thread-1", { text: "hi" });
    await flushPromises();
    expect(ctx.api.messages.value.length).toBe(1);

    ctx.invalidated.length = 0;
    ctx.fake.emitCustom({ type: "stream_replay_gap", run_id: "run-1" });
    await flushPromises();

    // 三条正面特征，缺一条都说明 A7 只做了一半。
    expect(ctx.api.messages.value).toEqual([]);
    expect(ctx.warnings).toEqual(["conversation.streamReplayGap"]);
    expect(ctx.invalidated).toContainEqual(["thread-messages", "thread-1"]);
    ctx.wrapper.unmount();
  });

  it("非 gap 的 custom 事件不清空任何东西", async () => {
    const ctx = mountStream();
    await ctx.api.sendMessage("thread-1", { text: "hi" });
    await flushPromises();

    ctx.fake.emitCustom({ type: "task_running", task_id: "t-1" });
    await flushPromises();

    expect(ctx.api.messages.value.length).toBe(1);
    expect(ctx.warnings).toEqual([]);
    ctx.wrapper.unmount();
  });
});

describe("useThreadStream · A8 停止后的两轮失效", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("stop 立刻失效六个 key，并在 1.5 秒后再来一轮", async () => {
    vi.useFakeTimers();
    const ctx = mountStream();
    await ctx.api.sendMessage("thread-1", { text: "hi" });
    await vi.advanceTimersByTimeAsync(0);

    ctx.invalidated.length = 0;
    await ctx.api.stop();

    const firstRound = [...ctx.invalidated];
    expect(firstRound).toEqual([
      ["threads", "search"],
      ["threads", "searchInfinite"],
      ["thread", "thread-1"],
      ["thread-messages", "thread-1"],
      ["thread", "metadata", "thread-1"],
      ["thread-token-usage", "thread-1"],
    ]);

    // 延迟那一次是 A8 的后半句：后端可能在 stop 之后才把标题定稿。
    await vi.advanceTimersByTimeAsync(1500);
    expect(ctx.invalidated.length).toBe(firstRound.length * 2);
    ctx.wrapper.unmount();
    vi.useRealTimers();
  });
});
