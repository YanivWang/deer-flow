import { describe, expect, it } from "vitest";

import { ThreadStreamEngine } from "../../../../app/core/stream/engine";
import { deriveThreadStreamViewModel } from "../../../../app/core/stream/view-model";

describe("stream reducer", () => {
  it("keeps live and replay snapshots equivalent for the same canonical events", () => {
    const live = new ThreadStreamEngine();
    const replay = new ThreadStreamEngine();
    const liveOwner = live.startOwner();
    const replayOwner = replay.startOwner();
    const events = [
      { type: "message_snapshot" as const, values: { messages: [] }, cursor: { eventId: "1" } },
      {
        type: "subtask_delta" as const,
        payload: { type: "task_running", task_id: "search" },
        cursor: { eventId: "2" },
      },
      {
        type: "artifact_delta" as const,
        payload: { path: "outputs/result.md" },
        cursor: { eventId: "2a" },
      },
      {
        type: "human_input_required" as const,
        payload: { request_id: "request-1" },
        cursor: { eventId: "2b" },
      },
      { type: "notice" as const, payload: { type: "stream_replay_gap" }, cursor: { eventId: "3" } },
      { type: "done" as const, cursor: { eventId: "4" } },
    ];

    for (const event of events) {
      live.accept(liveOwner, event);
    }
    for (const event of events) {
      replay.accept(replayOwner, event);
    }

    expect(live.getSnapshot()).toEqual(replay.getSnapshot());
    expect(live.getSnapshot().artifacts).toEqual([{ path: "outputs/result.md" }]);
    expect(live.getSnapshot().humanInputRequests).toEqual([{ request_id: "request-1" }]);
  });

  it("keeps live delta and replay values view-models equivalent", () => {
    const live = new ThreadStreamEngine();
    const replay = new ThreadStreamEngine();
    const liveOwner = live.startOwner();
    const replayOwner = replay.startOwner();
    const finalValues = {
      messages: [
        { id: "h-1", type: "human", content: "hi" },
        { id: "a-1", type: "ai", content: "hello" },
      ],
    };

    live.accept(liveOwner, {
      type: "message_delta",
      payload: { id: "a-1", type: "ai", content: "hel" },
      cursor: { eventId: "1" },
    });
    live.accept(liveOwner, {
      type: "message_snapshot",
      values: finalValues,
      cursor: { eventId: "2" },
    });
    replay.accept(replayOwner, {
      type: "message_snapshot",
      values: finalValues,
      cursor: { eventId: "2" },
    });

    expect(
      deriveThreadStreamViewModel(live.getSnapshot(), {
        runId: "run-1",
        status: "completed",
        threadId: "thread-1",
      }),
    ).toEqual(
      deriveThreadStreamViewModel(replay.getSnapshot(), {
        runId: "run-1",
        status: "completed",
        threadId: "thread-1",
      }),
    );
  });

  it("does not apply duplicate event ids twice", () => {
    const engine = new ThreadStreamEngine();
    const owner = engine.startOwner();
    const event = {
      type: "subtask_delta" as const,
      payload: { type: "task_running", task_id: "a" },
      cursor: { eventId: "10" },
    };

    engine.accept(owner, event);
    engine.accept(owner, event);

    expect(engine.getSnapshot().subtasks).toEqual([{ type: "task_running", task_id: "a" }]);
  });

  it("merges history replay with live values by stable message identity", () => {
    const engine = new ThreadStreamEngine();
    const owner = engine.startOwner();
    const historyMessages = [
      { id: "h-1", type: "human", content: "hi" },
      { id: "a-1", type: "ai", content: "old" },
    ];

    engine.accept(owner, {
      type: "message_snapshot",
      values: {
        messages: [
          { id: "a-1", type: "ai", content: "updated" },
          { id: "a-2", type: "ai", content: "new" },
        ],
      },
      cursor: { eventId: "2" },
    });

    expect(
      deriveThreadStreamViewModel(engine.getSnapshot(), {
        historyMessages,
        runId: "run-1",
        status: "streaming",
        threadId: "thread-1",
      }).messages.map((message) => [message.id, message.content]),
    ).toEqual([
      ["h-1", "hi"],
      ["a-1", "updated"],
      ["a-2", "new"],
    ]);
  });
});
