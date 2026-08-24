/*
  【文件职责】     把 M0 录到的 Gateway 协议事实钉成可执行断言（06 §M2 的"先写 L3 测试"）。
  【架构位置】     L3 测试
  【主要导出】     无
  【依赖关系】     @/core/agent-deerflow/* · tests/fixtures/streams/*.sse
  【边界与注意】   这里的每条断言都必须能追到一份**录制**或一份冻结文档，
                   不能来自"SDK 大概是这么干的"。05 L12 就是这么栽的：
                   SDK 的 metadata 读 Content-Location、reconnect helper 找
                   Location，两个 header 被当成等价的——而实测 Gateway 只发前者。

                   测试放 tests/unit/agent-deerflow/ 而不是 tests/unit/core/：
                   它断言的是本仓自有的 DeerFlow 协议适配层，不是 core 里的纯业务函数。
*/

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEERFLOW_WIRE_EVENTS,
  classifyDeerFlowEvent,
  parseWireEventName,
} from "@/core/agent-deerflow/event-map";
import {
  parseRunHandle,
  runCancelUrl,
  runResourceUrl,
  runResumeUrl,
  runStreamUrl,
} from "@/core/agent-deerflow/endpoints";
import { parseStreamReplayGap } from "@/core/agent-deerflow/gap";

const fixture = (name: string) =>
  readFileSync(
    new URL(`../../fixtures/streams/${name}`, import.meta.url),
    "utf8",
  );

/** 从录制里取出每一帧的 event 名与 data，供下面的断言复用。 */
function framesOf(raw: string): { event: string; data: string }[] {
  return raw
    .split("\n\n")
    .filter((f) => f.trim().length > 0 && !f.startsWith(":"))
    .flatMap((frame) => {
      const lines = frame.split("\n");
      const event = lines
        .find((l) => l.startsWith("event: "))
        ?.slice("event: ".length);
      const data = lines
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice("data: ".length))
        .join("\n");
      return event ? [{ event, data }] : [];
    });
}

const CREATE_FRAMES = framesOf(fixture("deerflow-create.sse"));
const GAP_FRAMES = framesOf(fixture("deerflow-resume-gap.sse"));

describe("wire 事件全集（08 §DeerFlow 请求模式与 wire event 全集）", () => {
  it("录制里出现的每个事件名都在事件表里——未知事件不能静默当成功", () => {
    const seen = [...new Set(CREATE_FRAMES.map((f) => f.event))];
    for (const name of seen) {
      expect(DEERFLOW_WIRE_EVENTS, `录制里有 ${name}，事件表里没有`).toContain(
        name,
      );
    }
  });

  it("请求模式写 messages-tuple，线上帧名是 messages", () => {
    // 08 §288。这两个名字混用会让事件表永远匹配不上，
    // 而"未知事件默认忽略"会把它变成一条静默的空白消息。
    const names = new Set(CREATE_FRAMES.map((f) => f.event));
    expect(names.has("messages")).toBe(true);
    expect(names.has("messages-tuple")).toBe(false);
  });

  it("`mode|namespace` 形式按 mode 归类", () => {
    // subagent 的事件带命名空间后缀；按整串匹配会全部落进"未知事件"。
    expect(parseWireEventName("updates|agent:1234")).toEqual({
      mode: "updates",
      namespace: "agent:1234",
    });
    expect(parseWireEventName("values")).toEqual({ mode: "values" });
  });

  it("带命名空间的事件与不带的分类一致", () => {
    expect(classifyDeerFlowEvent({ event: "updates|x", data: "{}" })).toEqual(
      classifyDeerFlowEvent({ event: "updates", data: "{}" }),
    );
  });
});

describe("事件 → 流走向（L1 的 ClassifyEvent 契约）", () => {
  const classify = (event: string, data = "{}") =>
    classifyDeerFlowEvent({ event, data });

  it("业务事件是 data", () => {
    for (const name of [
      "metadata",
      "values",
      "updates",
      "messages",
      "custom",
    ]) {
      expect(classify(name).kind, name).toBe("data");
    }
  });

  it("end 是正常终止", () => {
    expect(classify("end", "null").kind).toBe("completed");
  });

  it("error 是后端错误，且**不可重试**", () => {
    const signal = classify("error", '{"message":"boom"}');
    expect(signal.kind).toBe("failed");
    if (signal.kind !== "failed") return;
    expect(signal.error.retryable).toBe(false);
    expect(signal.error.kind).toBe("backend_error");
  });

  it("gap 是重放缺口，不是流结束（05 A6）", () => {
    // 当成正常结束会让仍在跑的后端 run 失去消费方，任务白跑。
    expect(classify("gap", GAP_FRAMES[0]?.data ?? "{}").kind).toBe("gap");
  });

  it("未知事件按 data 放行，但不是静默——调用方能看到原始事件", () => {
    // 08 §299：未知事件不能静默当成功。这里保持 data，让 reducer 决定，
    // 而不是在协议层直接丢掉。
    expect(classify("brand-new-event").kind).toBe("data");
  });
});

describe("重放缺口载荷（M0 实测）", () => {
  const payload = GAP_FRAMES[0]?.data ?? "";

  it("录制里的 gap 载荷能被解析", () => {
    const gap = parseStreamReplayGap(JSON.parse(payload));
    expect(gap.code).toBe("stream_replay_gap");
    expect(gap.recovery).toBe("reload_durable_state");
    expect(gap.latest_available_event_id).toBeTruthy();
  });

  it("requested_event_id 允许为 null（初始流的缺口没有请求游标）", () => {
    expect(
      parseStreamReplayGap({
        code: "stream_replay_gap",
        run_id: "r",
        requested_event_id: null,
        earliest_available_event_id: "1",
        latest_available_event_id: "2",
        recovery: "reload_durable_state",
      }).requested_event_id,
    ).toBeNull();
  });

  it("形状不对就抛，不能当成一个没有字段的 gap 继续走", () => {
    expect(() => parseStreamReplayGap({ code: "nope" })).toThrow();
    expect(() => parseStreamReplayGap(null)).toThrow();
  });
});

describe("endpoint 与 run handle（05 L12）", () => {
  const BASE = "https://example.test/api/langgraph";

  it("从 Content-Location 解析 run handle——实测 Gateway 只发这一个 header", () => {
    expect(parseRunHandle("/api/threads/t-1/runs/r-1")).toEqual({
      threadId: "t-1",
      runId: "r-1",
    });
  });

  it("缺失或形状不对时返回 null，不猜", () => {
    expect(parseRunHandle(null)).toBeNull();
    expect(parseRunHandle("/api/threads/t-1")).toBeNull();
    expect(parseRunHandle("garbage")).toBeNull();
  });

  it("create 是 POST 到 runs/stream", () => {
    expect(runStreamUrl(BASE, "t-1")).toBe(
      "https://example.test/api/langgraph/threads/t-1/runs/stream",
    );
  });

  it("resume 是既有 run 的 GET stream，不是 create 的 URL（05 L11）", () => {
    expect(runResumeUrl(BASE, { threadId: "t-1", runId: "r-1" })).toBe(
      "https://example.test/api/langgraph/threads/t-1/runs/r-1/stream",
    );
  });

  it("cancel 明确带 action 与 wait", () => {
    const url = runCancelUrl(BASE, { threadId: "t-1", runId: "r-1" });
    expect(url).toContain("/threads/t-1/runs/r-1/cancel");
    expect(url).toContain("action=interrupt");
    expect(url).toContain("wait=true");
  });

  it("inspect 读 durable run resource（不带 /stream）", () => {
    expect(runResourceUrl(BASE, { threadId: "t-1", runId: "r-1" })).toBe(
      "https://example.test/api/langgraph/threads/t-1/runs/r-1",
    );
  });

  it("URL 前缀保持 /api/langgraph——它是 nginx SSE 超时与 E2E 拦截的挂载点", () => {
    // 02 §"URL 前缀保持 /api/langgraph/*"。改前缀不是重构，是改部署契约。
    for (const url of [
      runStreamUrl(BASE, "t"),
      runResumeUrl(BASE, { threadId: "t", runId: "r" }),
      runCancelUrl(BASE, { threadId: "t", runId: "r" }),
      runResourceUrl(BASE, { threadId: "t", runId: "r" }),
    ]) {
      expect(url.startsWith(`${BASE}/`)).toBe(true);
    }
  });
});
