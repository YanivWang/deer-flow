import type { CanonicalStreamEvent } from "../canonical";
import type { DeerFlowWireEvent } from "../codec/deerflow-wire";

export function adaptDeerFlowGatewayEvent(event: DeerFlowWireEvent): CanonicalStreamEvent {
  if (event.kind === "end") {
    return { type: "done", cursor: event.id ? { eventId: event.id } : undefined };
  }

  if (event.kind === "gap") {
    return { type: "stream_gap", gap: event.gap };
  }

  const cursor = event.id ? { eventId: event.id } : undefined;
  if (event.event === "values") {
    return { type: "message_snapshot", values: event.data, cursor };
  }
  if (event.event === "messages") {
    return { type: "message_delta", payload: event.data, cursor };
  }
  if (event.event === "custom") {
    const customType =
      typeof event.data === "object" && event.data !== null
        ? Reflect.get(event.data, "type")
        : undefined;
    if (typeof customType === "string" && customType.startsWith("task_")) {
      return { type: "subtask_delta", payload: event.data, cursor };
    }
    return { type: "notice", payload: event.data, cursor };
  }
  return { type: "notice", payload: { event: event.event, data: event.data }, cursor };
}
