/*
  【文件职责】     解析 Gateway 的重放缺口载荷，并映射到内核的 replay_gap 错误。
  【架构位置】     L3
  【主要导出】     StreamReplayGapData · parseStreamReplayGap · replayGapError
  【依赖关系】     @deerflow/agent-core
  【边界与注意】   `gap` 这个 wire 事件名只属于 DeerFlow；内核那边的对应物叫
                   `replay_gap`（08 §错误与 watchdog）。两个名字的翻译只在这里
                   发生，别的地方出现 `"gap"` 字面量就说明协议知识漏出去了。

                   校验是**严格的**：字段缺一个就抛，不返回一个字段为 undefined
                   的对象。缺口恢复要用 `latest_available_event_id` 当新游标，
                   拿到 undefined 会让续传从头开始——那正是 05 A6 说的
                   「不得当作正常流结束」的另一种走形。
*/

import { AgentStreamError } from "@deerflow/agent-core";

export interface StreamReplayGapData {
  code: "stream_replay_gap";
  run_id: string;
  /** 初始流的缺口没有请求游标，这里是 null 而不是缺省。 */
  requested_event_id: string | null;
  earliest_available_event_id: string;
  latest_available_event_id: string;
  recovery: "reload_durable_state";
}

export function parseStreamReplayGap(data: unknown): StreamReplayGapData {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid stream replay gap payload.");
  }

  const value = data as Record<string, unknown>;
  const requestedEventId = value.requested_event_id;
  if (
    value.code !== "stream_replay_gap" ||
    typeof value.run_id !== "string" ||
    (requestedEventId !== null && typeof requestedEventId !== "string") ||
    typeof value.earliest_available_event_id !== "string" ||
    typeof value.latest_available_event_id !== "string" ||
    value.recovery !== "reload_durable_state"
  ) {
    throw new Error("Invalid stream replay gap payload.");
  }

  return value as unknown as StreamReplayGapData;
}

/** 缺口不可重试：重连解决不了「那段历史已经被逐出」。 */
export function replayGapError(gap: StreamReplayGapData): AgentStreamError {
  return new AgentStreamError(
    "replay_gap",
    `Stream history is no longer available from ${
      gap.requested_event_id ?? "the initial stream"
    }; earliest retained is ${gap.earliest_available_event_id}.`,
    { cause: gap },
  );
}
