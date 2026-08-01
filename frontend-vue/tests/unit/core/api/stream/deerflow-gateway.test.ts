import { describe, expect, it } from "vitest";

import { adaptDeerFlowGatewayEvent } from "../../../../../app/core/api/stream/adapters/deerflow-gateway";
import {
  decodeDeerFlowWireEvent,
  parseRunIdFromContentLocation,
} from "../../../../../app/core/api/stream/codec/deerflow-wire";
import { ThreadStreamEngine } from "../../../../../app/core/api/stream/engine";

describe("DeerFlow Gateway stream adapter", () => {
  it("parses Content-Location run ids", () => {
    expect(parseRunIdFromContentLocation("/api/threads/t/runs/r-123")).toBe("r-123");
  });

  it("maps values, messages, custom task events, gap, and end to canonical events", () => {
    const values = adaptDeerFlowGatewayEvent(
      decodeDeerFlowWireEvent({
        event: "values",
        id: "1",
        data: "{\"messages\":[]}",
      }),
    );
    const messages = adaptDeerFlowGatewayEvent(
      decodeDeerFlowWireEvent({
        event: "messages",
        id: "2",
        data: "[{\"type\":\"ai\"}]",
      }),
    );
    const task = adaptDeerFlowGatewayEvent(
      decodeDeerFlowWireEvent({
        event: "custom",
        id: "3",
        data: "{\"type\":\"task_running\",\"task_id\":\"a\"}",
      }),
    );
    const gap = adaptDeerFlowGatewayEvent(
      decodeDeerFlowWireEvent({
        event: "gap",
        data:
          "{\"code\":\"stream_replay_gap\",\"run_id\":\"r\",\"requested_event_id\":null,\"earliest_available_event_id\":\"1\",\"latest_available_event_id\":\"3\",\"recovery\":\"reload_durable_state\"}",
      }),
    );
    const end = adaptDeerFlowGatewayEvent(
      decodeDeerFlowWireEvent({ event: "end", id: "4", data: "null" }),
    );

    expect(values.type).toBe("message_snapshot");
    expect(messages.type).toBe("message_delta");
    expect(task.type).toBe("subtask_delta");
    expect(gap.type).toBe("stream_gap");
    expect(end).toEqual({ type: "done", cursor: { eventId: "4" } });
  });

  it("rejects events from an old stream owner", () => {
    const engine = new ThreadStreamEngine();
    const firstOwner = engine.startOwner();
    const secondOwner = engine.startOwner();

    expect(engine.accept(firstOwner, { type: "done" })).toBe(false);
    expect(engine.accept(secondOwner, { type: "done" })).toBe(true);
    expect(engine.getSnapshot().done).toBe(true);
  });
});
