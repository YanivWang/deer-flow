/*
  【文件职责】     06 §M2 验收清单的「接缝」一条：gap-recovery → reducer → store 的组合路径。
  【对应 frontend/】 无
  【架构位置】     L3 测试
  【主要导出】     无
  【依赖关系】     agent-deerflow/{gap-recovery,reducer,message-adapt,event-map} · @deerflow/agent-core
  【边界与注意】   **这份测试存在的理由是模块级全绿证明不了模块之间对得上。**
                   `gap-recovery` 恢复时会**合成**一帧 `values` 交给下游，而合成的形状
                   （事件名、`data` 是不是 JSON 字符串、载荷是全量还是补丁）只有 reducer
                   真正消费一次才知道对不对。两边各自有测试，中间这一步在此之前没人验过——
                   「每个模块都对、合起来不对」正是这一层最典型的失效形状。

                   第 2 条用例是这里最要紧的：gap 之后 durable state 必须**替换**。
                   如果合成帧被写成补丁形状，gap 之前的陈旧消息会留在列表里，
                   而所有单模块测试依然全绿。
*/

import { createAgentExternalStore } from "@deerflow/agent-core";
import type { AgentSnapshot, SseEvent } from "@deerflow/agent-core";
import { describe, expect, it } from "vitest";

import type { DeerFlowRunHandle } from "@/core/agent-deerflow/endpoints";
import { classifyDeerFlowEvent } from "@/core/agent-deerflow/event-map";
import { createGapAwareRun } from "@/core/agent-deerflow/gap-recovery";
import { toWireMessage } from "@/core/agent-deerflow/message-adapt";
import type { DeerFlowThreadState } from "@/core/agent-deerflow/reducer";
import {
  createDeerFlowEventReducer,
  EMPTY_DEERFLOW_THREAD_STATE,
} from "@/core/agent-deerflow/reducer";
import type { DeerFlowProtocol } from "@/core/agent-deerflow/run-protocol";

const HANDLE: DeerFlowRunHandle = { threadId: "t-1", runId: "r-1" };

const GAP = JSON.stringify({
  code: "stream_replay_gap",
  run_id: HANDLE.runId,
  requested_event_id: null,
  earliest_available_event_id: "c-5",
  latest_available_event_id: "c-9",
  recovery: "reload_durable_state",
});

/** 流断在 gap 之前已经推过一版 durable state，里面有一条只存在于"缺口之前"的消息。 */
const BEFORE_GAP =
  `event: values\ndata: ${JSON.stringify({
    title: "before",
    messages: [
      { id: "m-stale", type: "ai", content: "只存在于缺口之前" },
      {
        id: "m-keep",
        type: "human",
        content: [{ type: "text", text: "富内容" }],
      },
    ],
  })}\nid: c-1\n\n` + `event: gap\ndata: ${GAP}\nid: c-2\n\n`;

const AFTER_JOIN =
  `event: messages\ndata: ${JSON.stringify([
    { id: "m-new", type: "AIMessageChunk", content: "接上了" },
    { langgraph_node: "model" },
  ])}\nid: c-10\n\n` + `event: end\ndata: {}\n\n`;

/** 后端的权威 durable state：`m-stale` 已经不在里面了。 */
const DURABLE = {
  title: "after reload",
  artifacts: ["a.md"],
  messages: [
    {
      id: "m-keep",
      type: "human",
      content: [{ type: "text", text: "富内容" }],
    },
  ],
};

function scripted(segments: string[]): DeerFlowProtocol {
  let index = 0;
  const next = () =>
    new Response(segments[Math.min(index++, segments.length - 1)] as string);
  return {
    create: async () => ({ handle: HANDLE, response: next() }),
    resume: async () => next(),
    cancel: async () => ({ kind: "accepted" }),
    inspect: async () => ({ terminal: true, outcome: "completed" }),
  };
}

interface Wired {
  snapshot: AgentSnapshot<DeerFlowThreadState>;
  reloads: number;
  /** 真正被 store 消费掉的合成 durable 帧数——不是 reload 次数，两者可能不等。 */
  synthesized: number;
  terminal: string;
}

/** 把 gap-recovery 的输出真的接进 store —— 这条线就是本文件要验的东西。 */
async function wire(segments: string[], maxRejoins?: number): Promise<Wired> {
  const store = createAgentExternalStore<DeerFlowThreadState, SseEvent>({
    initialState: EMPTY_DEERFLOW_THREAD_STATE,
    reducer: createDeerFlowEventReducer(),
    createId: () => "generated",
    now: () => 0,
  });

  let reloads = 0;
  const run = createGapAwareRun({
    protocol: scripted(segments),
    session: {
      classifyEvent: classifyDeerFlowEvent,
      maxBufferBytes: 1024 * 1024,
      maxReconnects: 0,
      sleep: async () => {},
    },
    loadDurableState: async () => {
      reloads += 1;
      return DURABLE;
    },
    ...(maxRejoins === undefined ? {} : { maxRejoins }),
  });

  let terminal = "";
  let synthesized = 0;
  for await (const output of run.run({ threadId: "t-1", payload: {} })) {
    if (output.kind === "event") {
      // 合成帧与流上真实的 values 帧长得一样（这正是它能被 reducer 消费的原因），
      // 所以只能按载荷区分：只有 durable reload 才带 "after reload"。
      if (output.event.data.includes("after reload")) synthesized += 1;
      store.dispatch(output.event);
    }
    if (output.kind === "state") terminal = output.state.status;
  }
  store.flushNotifications();
  return { snapshot: store.getSnapshot(), reloads, synthesized, terminal };
}

describe("接缝：gap-recovery → reducer → store", () => {
  it("合成的 durable 帧真的被 reducer 消费了（形状对得上）", async () => {
    const { snapshot, reloads, terminal } = await wire([
      BEFORE_GAP,
      AFTER_JOIN,
    ]);

    expect(reloads).toBe(1);
    expect(terminal).toBe("completed");
    // 合成帧的 data 是 JSON 字符串、事件名是 values —— 两边任何一处不一致，
    // reducer 都会把它当未知事件忽略，而 gap-recovery 那侧照样全绿。
    expect(snapshot.state.title).toBe("after reload");
    expect(snapshot.state.artifacts).toEqual(["a.md"]);
  });

  it("gap 之后 durable state 是**替换**：缺口之前的陈旧消息不会留下", async () => {
    const { snapshot } = await wire([BEFORE_GAP, AFTER_JOIN]);

    expect(snapshot.messageIds).not.toContain("m-stale");
    expect(snapshot.messageIds).toContain("m-keep");
    // join 流接上之后新到的分片照常落进来。
    expect(snapshot.messages["m-new"]?.content).toBe("接上了");
  });

  it("富内容穿过整条路径没有被压成字符串", async () => {
    const { snapshot } = await wire([BEFORE_GAP, AFTER_JOIN]);

    const kept = snapshot.messages["m-keep"];
    expect(Array.isArray(kept?.content)).toBe(true);
    expect(toWireMessage(kept as NonNullable<typeof kept>)).toEqual(
      DURABLE.messages[0],
    );
  });

  it("每次 rejoin 都各自 reload 一次，而且每一次都真的进了 reducer", async () => {
    // 一直 gap。**接缝在这里最容易只对第一次成立**：合成帧如果是在循环外发的，
    // 或者第二段之后 protocol 被换掉导致载荷走形，第 1 次会绿、后面几次静默丢失。
    const { snapshot, reloads, synthesized, terminal } = await wire(
      [BEFORE_GAP],
      3,
    );

    expect(reloads).toBe(3);
    expect(synthesized).toBe(3);
    // A6：预算用尽落 failed，不是 completed。
    expect(terminal).toBe("failed");

    // 末态 durable 值是**最后一段流自己推的那帧**，不是最后一次 reload——
    // 因为 rejoin 之后那段流又推了一版 values 才再次 gap。这不是缺陷：
    // 流上后到的 values 本来就该覆盖 reload 的值，两者都是全量快照。
    expect(snapshot.state.title).toBe("before");
    expect(snapshot.messageIds).toContain("m-stale");
  });
});
