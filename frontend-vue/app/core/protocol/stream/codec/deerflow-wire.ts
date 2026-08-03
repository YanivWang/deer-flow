import type { StreamReplayGapData } from "../canonical";
import type { ParsedSseEvent } from "../../../stream/transport/sse-event";
import { StreamEngineError } from "../../../stream/transport/stream-error";

export type DeerFlowWireEvent =
  | { kind: "payload"; event: string; data: unknown; id?: string }
  | { kind: "gap"; gap: StreamReplayGapData }
  | { kind: "end"; id?: string };

export function parseRunIdFromContentLocation(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const match = /\/runs\/([^/?#]+)/.exec(value);
  const encodedRunId = match?.[1];
  return encodedRunId ? decodeURIComponent(encodedRunId) : undefined;
}

export function decodeDeerFlowWireEvent(frame: ParsedSseEvent): DeerFlowWireEvent {
  let data: unknown;
  try {
    data = JSON.parse(frame.data);
  } catch (error) {
    throw new StreamEngineError("protocol", "无效的 DeerFlow SSE JSON payload。", error);
  }

  if (frame.event === "end") {
    return { kind: "end", ...(frame.id ? { id: frame.id } : {}) };
  }

  if (frame.event === "gap") {
    return { kind: "gap", gap: parseStreamReplayGapData(data) };
  }

  return {
    kind: "payload",
    event: frame.event,
    data,
    ...(frame.id ? { id: frame.id } : {}),
  };
}

function parseStreamReplayGapData(data: unknown): StreamReplayGapData {
  if (typeof data !== "object" || data === null) {
    throw new StreamEngineError("gap", "无效的流重放缺口 payload。");
  }
  const value = data as Partial<StreamReplayGapData>;
  if (
    value.code !== "stream_replay_gap" ||
    typeof value.run_id !== "string" ||
    (value.requested_event_id !== null && typeof value.requested_event_id !== "string") ||
    typeof value.earliest_available_event_id !== "string" ||
    typeof value.latest_available_event_id !== "string" ||
    value.recovery !== "reload_durable_state"
  ) {
    throw new StreamEngineError("gap", "无效的流重放缺口 payload。");
  }
  return {
    code: value.code,
    run_id: value.run_id,
    requested_event_id: value.requested_event_id,
    earliest_available_event_id: value.earliest_available_event_id,
    latest_available_event_id: value.latest_available_event_id,
    recovery: value.recovery,
  };
}
