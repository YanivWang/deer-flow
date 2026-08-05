/*
  【文件职责】     归约动作与 external store 的行为（08 §事件与完整状态归约）。
  【对应 frontend/】 无
  【架构位置】     L1 测试
  【主要导出】     无
  【依赖关系】     ../src/store/* · ../src/message
  【边界与注意】   不断言「Vue 组件会不会重渲染」——那是 L3 adapter 的测试。
                   这里只断言 store 该有的两个性质：快照按引用换新、
                   订阅者被通知到。
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
    expect(listener).toHaveBeenCalledTimes(1);
    // 引用必须变：useSyncExternalStore 与 shallowRef 都靠引用比较判断重渲染。
    expect(s.getSnapshot()).not.toBe(before);
  });

  it("reducer 返回空数组时不通知", () => {
    const s = store();
    const listener = vi.fn();
    s.subscribe(listener);
    s.dispatch({ kind: "noop" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("退订之后不再被通知", () => {
    const s = store();
    const listener = vi.fn();
    const off = s.subscribe(listener);
    off();
    s.dispatch({ kind: "m1" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("订阅者在回调里退订不会让后面的监听者被跳过", () => {
    const s = store();
    const second = vi.fn();
    const off = s.subscribe(() => off());
    s.subscribe(second);
    s.dispatch({ kind: "m1" });
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
