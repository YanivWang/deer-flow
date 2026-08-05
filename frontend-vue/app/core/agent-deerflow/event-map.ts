/*
  【文件职责】     DeerFlow wire 事件名 → 流走向；内核唯一的协议知识入口的实现方。
  【对应 frontend/】 SDK 的 StreamManager（没有可搬的对应文件）
  【架构位置】     L3
  【主要导出】     DEERFLOW_WIRE_EVENTS · parseWireEventName · classifyDeerFlowEvent
  【依赖关系】     @deerflow/agent-core · ./gap
  【边界与注意】   **请求模式与 wire 事件名是两组名字，不能混用（08 §288）。**
                   提交的是 `messages-tuple`，Gateway 转成 LangGraph 的 `messages`，
                   所以线上帧名是 `messages`。照着请求模式写事件表，`messages`
                   会永远匹配不上，然后被"未知事件默认忽略"吞掉——症状是
                   流式文本一个字都不出现，而没有任何报错。

                   `mode|namespace` 形式必须按 mode 归类：子 agent 的事件带命名
                   空间后缀，按整串匹配会让所有 subagent 事件落进未知分支。

                   未知事件**不静默丢弃**：这里一律归为 `data` 交给 reducer，
                   由它决定忽略还是记 warning（08 §299）。在协议层直接丢掉，
                   等于新加一个事件类型时前端安静地少显示一块内容。
*/

import type {
  ClassifyEvent,
  SseEvent,
  StreamSignal,
} from "@deerflow/agent-core";
import { AgentStreamError } from "@deerflow/agent-core";

/**
 * 当前 Gateway 会发出的 wire 事件名全集。
 *
 * 前 8 个是业务事件，后 3 个是控制事件。心跳不在表里——它在传输层就被识别成
 * 注释帧，根本到不了这里。
 */
export const DEERFLOW_WIRE_EVENTS = [
  "metadata",
  "values",
  "updates",
  "messages",
  "custom",
  "checkpoints",
  "tasks",
  "debug",
  "error",
  "end",
  "gap",
] as const;

export type DeerFlowWireEvent = (typeof DEERFLOW_WIRE_EVENTS)[number];

export interface ParsedWireEventName {
  mode: string;
  namespace?: string;
}

/** `updates|agent:1234` → `{ mode: "updates", namespace: "agent:1234" }` */
export function parseWireEventName(name: string): ParsedWireEventName {
  const at = name.indexOf("|");
  if (at === -1) return { mode: name };
  return { mode: name.slice(0, at), namespace: name.slice(at + 1) };
}

export function isKnownWireEvent(name: string): boolean {
  return (DEERFLOW_WIRE_EVENTS as readonly string[]).includes(
    parseWireEventName(name).mode,
  );
}

/**
 * 后端 `error` 事件的载荷形状不固定，取一个能读的字段当消息，读不出来就用原文。
 * 这里不做严格校验：把一条已经确定是错误的事件因为形状不对再变成解析错误，
 * 只会把真正的原因盖掉。
 */
function backendErrorMessage(data: string): string {
  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed === "string") return parsed;
    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      for (const key of ["message", "detail", "error"]) {
        const value = record[key];
        if (typeof value === "string") return value;
      }
    }
  } catch {
    // 不是 JSON 就按原文处理。
  }
  return data || "The backend reported an error.";
}

export const classifyDeerFlowEvent: ClassifyEvent = (
  event: SseEvent,
): StreamSignal => {
  const { mode } = parseWireEventName(event.event);

  if (mode === "end") return { kind: "completed" };
  if (mode === "gap") return { kind: "gap" };
  if (mode === "error") {
    return {
      kind: "failed",
      error: new AgentStreamError(
        "backend_error",
        backendErrorMessage(event.data),
      ),
    };
  }
  return { kind: "data" };
};
