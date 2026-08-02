import type { CanonicalStreamEvent } from "./canonical";

export type StreamSnapshot = {
  cursor?: string;
  values?: unknown;
  messageDeltas: unknown[];
  notices: unknown[];
  subtasks: unknown[];
  artifacts: unknown[];
  humanInputRequests: unknown[];
  done: boolean;
  gapCount: number;
  seenEventIds: string[];
};

export const initialStreamSnapshot = (): StreamSnapshot => ({
  messageDeltas: [],
  notices: [],
  subtasks: [],
  artifacts: [],
  humanInputRequests: [],
  done: false,
  gapCount: 0,
  seenEventIds: [],
});

export function reduceStreamSnapshot(
  snapshot: StreamSnapshot,
  event: CanonicalStreamEvent,
): StreamSnapshot {
  const eventId = "cursor" in event ? event.cursor?.eventId : undefined;
  if (eventId && snapshot.seenEventIds.includes(eventId)) {
    return snapshot;
  }

  const cursor = eventId ?? snapshot.cursor;
  const seenEventIds = eventId ? [...snapshot.seenEventIds, eventId] : snapshot.seenEventIds;

  if (event.type === "message_snapshot") {
    return { ...snapshot, cursor, seenEventIds, values: event.values };
  }
  if (event.type === "message_delta") {
    return {
      ...snapshot,
      cursor,
      messageDeltas: [...snapshot.messageDeltas, event.payload],
      seenEventIds,
    };
  }
  if (event.type === "subtask_delta") {
    return { ...snapshot, cursor, seenEventIds, subtasks: [...snapshot.subtasks, event.payload] };
  }
  if (event.type === "artifact_delta") {
    return { ...snapshot, cursor, seenEventIds, artifacts: [...snapshot.artifacts, event.payload] };
  }
  if (event.type === "human_input_required") {
    return {
      ...snapshot,
      cursor,
      seenEventIds,
      humanInputRequests: [...snapshot.humanInputRequests, event.payload],
    };
  }
  if (event.type === "notice") {
    return { ...snapshot, cursor, seenEventIds, notices: [...snapshot.notices, event.payload] };
  }
  if (event.type === "stream_gap") {
    return { ...snapshot, gapCount: snapshot.gapCount + 1 };
  }
  if (event.type === "done") {
    return { ...snapshot, cursor, seenEventIds, done: true };
  }
  return { ...snapshot, cursor, seenEventIds };
}
