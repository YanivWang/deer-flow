/*
  【文件职责】     归约动作与 external store 的行为（08 §事件与完整状态归约）。
  【对应 frontend/】 无
  【架构位置】     L1 测试
  【主要导出】     无
  【依赖关系】     ../src/store/* · ../src/message
  【边界与注意】   不断言「Vue 组件会不会重渲染」——那是 L3 adapter 的测试。
                   这里只断言 store 该有的三个性质：快照按引用换新、
                   订阅者被通知到、通知按 05 A1 合并到同一个宏任务。

                   A1 那一组用的是**真的 `queueMicrotask` 与真的宏任务边界**，
                   不是注入的假调度器。假调度器只能证明「代码调用了注入的函数」，
                   证明不了默认档到底是合并还是防抖——而 A1 禁的恰恰是默认档
                   被写成防抖。注入档另有一条用例单独覆盖。
*/

import { describe, expect, it, vi } from "vitest";

import { createAgentMessage } from "../src/message";
import type { AgentMessage } from "../src/message";
import {
  applyReduceActions,
  createAgentExternalStore,
} from "../src/store/external-store";
import type { AgentSnapshot, ReduceAction } from "../src/store/snapshot";

interface State {
  todos: string[];
  goal?: string;
}

const blank = (): AgentSnapshot<State> => ({
  state: { todos: [] },
  messageIds: [],
  messages: {},
  session: { status: "idle" },
  lastActivityAt: 0,
});

const msg = (id: string, over: Partial<AgentMessage> = {}) =>
  createAgentMessage(id, "assistant", over);

const apply = (
  snapshot: AgentSnapshot<State>,
  actions: ReduceAction<State>[],
  now = 1,
) => applyReduceActions(snapshot, actions, now);

describe("完整 state 与消息同一次归约（05 L15）", () => {
  it("一批 action 里 state、消息顺序、会话状态一起落地", () => {
    const next = apply(blank(), [
      { type: "replace-state", state: { todos: ["a"], goal: "ship" } },
      { type: "upsert-message", message: msg("m1") },
      { type: "session", session: { status: "streaming", handle: "h" } },
    ]);
    expect(next.state).toEqual({ todos: ["a"], goal: "ship" });
    expect(next.messageIds).toEqual(["m1"]);
    expect(next.session.status).toBe("streaming");
  });

  it("patch-state 是浅合并，不动没提到的键", () => {
    const base = apply(blank(), [
      { type: "replace-state", state: { todos: ["a"], goal: "x" } },
    ]);
    expect(
      apply(base, [{ type: "patch-state", patch: { todos: [] } }]).state,
    ).toEqual({ todos: [], goal: "x" });
  });

  it("replace-state 是整体替换，旧键会消失", () => {
    const base = apply(blank(), [
      { type: "replace-state", state: { todos: ["a"], goal: "x" } },
    ]);
    expect(
      apply(base, [{ type: "replace-state", state: { todos: [] } }]).state,
    ).toEqual({ todos: [] });
  });
});

describe("消息归并", () => {
  it("chunk 是追加不是覆盖", () => {
    const base = apply(blank(), [
      { type: "upsert-message", message: msg("m1", { contentChunks: ["He"] }) },
    ]);
    const next = apply(base, [
      {
        type: "merge-message",
        messageId: "m1",
        message: msg("m1", { contentChunks: ["llo"], content: "Hello" }),
      },
    ]);
    // 覆盖语义下这里会变成 ["llo"]，流式文本表现为「越流越短」。
    expect(next.messages.m1?.contentChunks).toEqual(["He", "llo"]);
    expect(next.messages.m1?.content).toBe("Hello");
  });

  it("两边都没有 reasoning 时不写这个键，而不是写 undefined", () => {
    const next = apply(blank(), [
      { type: "upsert-message", message: msg("m1") },
      { type: "merge-message", messageId: "m1", message: msg("m1") },
    ]);
    expect("reasoningChunks" in (next.messages.m1 ?? {})).toBe(false);
  });

  it("afterId 决定插入位置", () => {
    const base = apply(blank(), [
      { type: "upsert-message", message: msg("a") },
      { type: "upsert-message", message: msg("c") },
    ]);
    const next = apply(base, [
      { type: "upsert-message", message: msg("b"), afterId: "a" },
    ]);
    expect(next.messageIds).toEqual(["a", "b", "c"]);
  });

  it("afterId 找不到时退到末尾，不丢消息", () => {
    const next = apply(blank(), [
      { type: "upsert-message", message: msg("a"), afterId: "nope" },
    ]);
    expect(next.messageIds).toEqual(["a"]);
  });

  it("重复 upsert 同一个 id 不会让它在列表里出现两次", () => {
    const next = apply(blank(), [
      { type: "upsert-message", message: msg("a", { contentChunks: ["1"] }) },
      { type: "upsert-message", message: msg("a", { contentChunks: ["2"] }) },
    ]);
    expect(next.messageIds).toEqual(["a"]);
    expect(next.messages.a?.contentChunks).toEqual(["1", "2"]);
  });

  it("merge 一个不存在的 id 是空操作，不会凭空造一条", () => {
    const next = apply(blank(), [
      { type: "merge-message", messageId: "ghost", message: msg("ghost") },
    ]);
    expect(next.messageIds).toEqual([]);
  });

  it("临时 id 改写成服务端 id 时**位置不动**", () => {
    const base = apply(blank(), [
      { type: "upsert-message", message: msg("tmp") },
      { type: "upsert-message", message: msg("after") },
    ]);
    const next = apply(base, [
      { type: "rewrite-message-id", fromId: "tmp", message: msg("real") },
    ]);
    // 删掉再插入的写法会把它挪到末尾——用户看到自己刚发的那条突然跳走。
    expect(next.messageIds).toEqual(["real", "after"]);
    expect(next.messages.tmp).toBeUndefined();
  });

  it("改写 id 时保留已经收到的 chunk", () => {
    const base = apply(blank(), [
      {
        type: "upsert-message",
        message: msg("tmp", { contentChunks: ["hi"] }),
      },
    ]);
    const next = apply(base, [
      { type: "rewrite-message-id", fromId: "tmp", message: msg("real") },
    ]);
    expect(next.messages.real?.contentChunks).toEqual(["hi"]);
  });

  it("remove 同时清掉顺序与内容", () => {
    const base = apply(blank(), [
      { type: "upsert-message", message: msg("a") },
    ]);
    const next = apply(base, [{ type: "remove-message", messageId: "a" }]);
    expect(next.messageIds).toEqual([]);
    expect(next.messages).toEqual({});
  });

  it("ignore 不改任何东西（除了活动时间）", () => {
    const base = apply(blank(), [
      { type: "upsert-message", message: msg("a") },
    ]);
    const next = apply(base, [{ type: "ignore" }], 99);
    expect(next.messageIds).toEqual(base.messageIds);
    expect(next.messages).toEqual(base.messages);
  });
});

describe("external store", () => {
  const store = () =>
    createAgentExternalStore<State, { kind: string }>({
      initialState: { todos: [] },
      reducer: (event) =>
        event.kind === "noop"
          ? []
          : [{ type: "upsert-message", message: msg(event.kind) }],
      createId: () => "id",
      now: () => 42,
    });

  it("快照按引用换新，订阅者收到通知", () => {
    const s = store();
    const listener = vi.fn();
    s.subscribe(listener);
    const before = s.getSnapshot();
    s.dispatch({ kind: "m1" });
    s.flushNotifications();
    expect(listener).toHaveBeenCalledTimes(1);
    // 引用必须变：useSyncExternalStore 与 shallowRef 都靠引用比较判断重渲染。
    expect(s.getSnapshot()).not.toBe(before);
  });

  it("reducer 返回空数组时不通知", () => {
    const s = store();
    const listener = vi.fn();
    s.subscribe(listener);
    s.dispatch({ kind: "noop" });
    s.flushNotifications();
    expect(listener).not.toHaveBeenCalled();
  });

  it("退订之后不再被通知", () => {
    const s = store();
    const listener = vi.fn();
    const off = s.subscribe(listener);
    off();
    s.dispatch({ kind: "m1" });
    s.flushNotifications();
    expect(listener).not.toHaveBeenCalled();
  });

  it("订阅者在回调里退订不会让后面的监听者被跳过", () => {
    const s = store();
    const second = vi.fn();
    const off = s.subscribe(() => off());
    s.subscribe(second);
    s.dispatch({ kind: "m1" });
    s.flushNotifications();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("reset 清空消息并换新 state", () => {
    const s = store();
    s.dispatch({ kind: "m1" });
    s.reset({ todos: ["fresh"] });
    expect(s.getSnapshot()).toMatchObject({
      state: { todos: ["fresh"] },
      messageIds: [],
      session: { status: "idle" },
    });
  });

  it("两个 store 互不干扰", () => {
    const a = store();
    const b = store();
    a.dispatch({ kind: "only-a" });
    expect(b.getSnapshot().messageIds).toEqual([]);
  });
});

describe("通知合并（05 A1）", () => {
  const store = (scheduleNotify?: (flush: () => void) => void) =>
    createAgentExternalStore<State, { kind: string }>({
      initialState: { todos: [] },
      reducer: (event) => [
        { type: "upsert-message", message: msg(event.kind) },
      ],
      createId: () => "id",
      now: () => 42,
      ...(scheduleNotify === undefined ? {} : { scheduleNotify }),
    });

  /** 让出一个宏任务。`setTimeout` 只出现在测试里，实现里一个都没有。 */
  const macrotask = () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

  it("同一个宏任务里派发 50 次，只通知一次", async () => {
    const s = store();
    const listener = vi.fn();
    s.subscribe(listener);

    for (let i = 0; i < 50; i += 1) s.dispatch({ kind: `m${i}` });
    // 通知还没发，但数据已经全在了——合并的是通知，不是数据。
    expect(listener).not.toHaveBeenCalled();
    expect(s.getSnapshot().messageIds).toHaveLength(50);

    await macrotask();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("不是尾部防抖：chunk 持续到达时每个宏任务都会通知，不会被饿死", async () => {
    const s = store();
    const listener = vi.fn();
    s.subscribe(listener);

    // 三个宏任务，每个里面派发 5 次。合并档 = 3 次通知；
    // 同步档 = 15 次；固定延时的尾部防抖 = 0 次（一直被后面的 chunk 推后）。
    for (let turn = 0; turn < 3; turn += 1) {
      for (let i = 0; i < 5; i += 1) s.dispatch({ kind: `t${turn}-${i}` });
      await macrotask();
      expect(listener).toHaveBeenCalledTimes(turn + 1);
    }
  });

  it("flushNotifications 立刻发出，且不会在检查点再发一次", async () => {
    const s = store();
    const listener = vi.fn();
    s.subscribe(listener);

    s.dispatch({ kind: "m1" });
    s.flushNotifications();
    expect(listener).toHaveBeenCalledTimes(1);

    await macrotask();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("没有挂起的通知时 flush 是空操作", () => {
    const s = store();
    const listener = vi.fn();
    s.subscribe(listener);
    s.flushNotifications();
    expect(listener).not.toHaveBeenCalled();
  });

  it("调度器可替换（宿主可以换成自己的宏任务边界）", () => {
    const scheduled: (() => void)[] = [];
    const s = store((flush) => scheduled.push(flush));
    const listener = vi.fn();
    s.subscribe(listener);

    s.dispatch({ kind: "m1" });
    s.dispatch({ kind: "m2" });
    expect(scheduled).toHaveLength(1);
    expect(listener).not.toHaveBeenCalled();

    scheduled[0]?.();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reset 也走同一条合并路径", async () => {
    const s = store();
    const listener = vi.fn();
    s.subscribe(listener);

    s.dispatch({ kind: "m1" });
    s.reset({ todos: ["fresh"] });
    await macrotask();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(s.getSnapshot().messageIds).toEqual([]);
  });
});
