import type { StreamEngineError } from "./transport/stream-error";

export type StreamCursor = {
  eventId?: string;
};

export type StreamReplayGapData = {
  code: "stream_replay_gap";
  run_id: string;
  requested_event_id: string | null;
  earliest_available_event_id: string;
  latest_available_event_id: string;
  recovery: "reload_durable_state";
};

export type CanonicalStreamEvent =
  | { type: "connected"; runId?: string; threadId?: string; cursor?: StreamCursor }
  | { type: "message_delta"; payload: unknown; cursor?: StreamCursor }
  | { type: "message_snapshot"; values: unknown; cursor?: StreamCursor }
  | { type: "subtask_delta"; payload: unknown; cursor?: StreamCursor }
  | { type: "notice"; payload: unknown; cursor?: StreamCursor }
  | { type: "stream_gap"; gap: StreamReplayGapData }
  | { type: "error"; error: StreamEngineError; cursor?: StreamCursor }
  | { type: "done"; cursor?: StreamCursor }
  | { type: "aborted" };
