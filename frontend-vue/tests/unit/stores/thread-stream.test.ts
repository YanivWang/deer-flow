import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CancelDeerFlowThreadStreamOptions,
  JoinDeerFlowThreadStreamOptions,
  StartDeerFlowThreadStreamOptions,
} from "../../../app/core/api/stream/client";
import type { CanonicalStreamEvent } from "../../../app/core/api/stream/canonical";
import { useThreadStreamStore } from "../../../app/stores/thread-stream";

const streamClientMocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  join: vi.fn(),
  start: vi.fn(),
}));

vi.mock("../../../app/core/api/stream/client", () => ({
  cancelDeerFlowThreadStream: streamClientMocks.cancel,
  joinDeerFlowThreadStream: streamClientMocks.join,
  startDeerFlowThreadStream: streamClientMocks.start,
}));

describe("thread stream store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    streamClientMocks.cancel.mockReset();
    streamClientMocks.join.mockReset();
    streamClientMocks.start.mockReset();
  });

  it("does not start a run for an empty draft", async () => {
    const store = useThreadStreamStore();

    await store.sendMessage({ text: "   ", threadId: "thread-1" });

    expect(streamClientMocks.start).not.toHaveBeenCalled();
    expect(store.status).toBe("idle");
  });

  it("sends trimmed text and overlays live messages on top of loaded history", async () => {
    streamClientMocks.start.mockImplementation(async (options: StartDeerFlowThreadStreamOptions) => {
      const owner = options.engine.startOwner();
      emit(options, owner, { runId: "run-1", threadId: "thread-1", type: "connected" });
      emit(options, owner, {
        cursor: { eventId: "1" },
        type: "message_snapshot",
        values: {
          messages: [
            { id: "a-1", type: "ai", content: "updated" },
            { id: "a-2", type: "ai", content: "new" },
          ],
        },
      });
      emit(options, owner, { cursor: { eventId: "2" }, type: "done" });
      return { runId: "run-1", snapshot: options.engine.getSnapshot() };
    });
    const store = useThreadStreamStore();
    store.setHistoryMessages([
      { id: "h-1", type: "human", content: "hi" },
      { id: "a-1", type: "ai", content: "old" },
    ]);

    await store.sendMessage({
      context: { agent_name: "researcher" },
      endpointBase: "http://gateway.test",
      text: "  hello  ",
      threadId: "thread-1",
    });

    const startOptions = streamClientMocks.start.mock.calls[0]?.[0] as
      | StartDeerFlowThreadStreamOptions
      | undefined;
    expect(startOptions?.endpointBase).toBe("http://gateway.test");
    expect(startOptions?.context).toEqual({ agent_name: "researcher" });
    expect(startOptions?.input).toEqual({ messages: [{ type: "human", content: "hello" }] });
    expect(store.status).toBe("completed");
    expect(store.activeRunId).toBe("run-1");
    const renderedMessages = store.viewModel.messages.map((message) => [message.id, message.content]);
    expect(renderedMessages).toHaveLength(4);
    expect(renderedMessages[0]).toEqual(["h-1", "hi"]);
    expect(renderedMessages[1]).toEqual(["a-1", "updated"]);
    expect(renderedMessages[2]?.[0]).toMatch(/^optimistic-/);
    expect(renderedMessages[2]?.[1]).toBe("hello");
    expect(renderedMessages[3]).toEqual(["a-2", "new"]);
  });

  it("passes hidden human-input response metadata into run input messages", async () => {
    streamClientMocks.start.mockImplementation(async (options: StartDeerFlowThreadStreamOptions) => {
      const owner = options.engine.startOwner();
      emit(options, owner, { runId: "run-1", threadId: "thread-1", type: "connected" });
      emit(options, owner, { cursor: { eventId: "1" }, type: "done" });
      return { runId: "run-1", snapshot: options.engine.getSnapshot() };
    });
    const store = useThreadStreamStore();
    const humanInputResponse = {
      version: 1,
      kind: "human_input_response",
      source: "ask_clarification",
      request_id: "request-1",
      response_kind: "text",
      value: "Use the fast path",
    };

    await store.sendMessage({
      additionalKwargs: {
        hide_from_ui: true,
        human_input_response: humanInputResponse,
      },
      text: "For your clarification, my answer is: Use the fast path",
      threadId: "thread-1",
    });

    const startOptions = streamClientMocks.start.mock.calls[0]?.[0] as
      | StartDeerFlowThreadStreamOptions
      | undefined;
    expect(startOptions?.input).toEqual({
      messages: [
        {
          type: "human",
          content: "For your clarification, my answer is: Use the fast path",
          additional_kwargs: {
            hide_from_ui: true,
            human_input_response: humanInputResponse,
          },
        },
      ],
    });
  });

  it("surfaces start failures without marking the run completed", async () => {
    streamClientMocks.start.mockRejectedValue(new Error("gateway refused the run"));
    const store = useThreadStreamStore();

    await store.sendMessage({ text: "hello", threadId: "thread-1" });

    expect(store.status).toBe("error");
    expect(store.errorMessage).toBe("gateway refused the run");
    expect(store.activeThreadId).toBe("thread-1");
    expect(store.activeRunId).toBeNull();
    expect(store.viewModel.done).toBe(false);
  });

  it("marks a join gap as recovering until durable values arrive", async () => {
    const statuses: string[] = [];
    streamClientMocks.join.mockImplementation(async (options: JoinDeerFlowThreadStreamOptions) => {
      const owner = options.engine.startOwner();
      emit(options, owner, { runId: "run-1", threadId: "thread-1", type: "connected" });
      emit(options, owner, {
        gap: {
          code: "stream_replay_gap",
          earliest_available_event_id: "3",
          latest_available_event_id: "7",
          recovery: "reload_durable_state",
          requested_event_id: "1",
          run_id: "run-1",
        },
        type: "stream_gap",
      });
      statuses.push(useThreadStreamStore().status);
      emit(options, owner, {
        cursor: { eventId: "7" },
        type: "message_snapshot",
        values: { messages: [{ id: "a-1", type: "ai", content: "restored" }] },
      });
      statuses.push(useThreadStreamStore().status);
      emit(options, owner, { cursor: { eventId: "8" }, type: "done" });
      return { runId: "run-1", snapshot: options.engine.getSnapshot() };
    });
    const store = useThreadStreamStore();

    await store.joinRun({
      lastEventId: "1",
      runId: "run-1",
      threadId: "thread-1",
    });

    expect(statuses).toEqual(["recovering", "streaming"]);
    expect(store.status).toBe("completed");
    expect(store.activeRunId).toBe("run-1");
    expect(store.viewModel.cursor).toBe("8");
    expect(store.viewModel.gapCount).toBe(1);
    expect(streamClientMocks.join).toHaveBeenCalledWith(
      expect.objectContaining({ lastEventId: "1", runId: "run-1", threadId: "thread-1" }),
    );
  });

  it("surfaces join failures and keeps the attempted run identity", async () => {
    streamClientMocks.join.mockRejectedValue(new Error("retained tail expired"));
    const store = useThreadStreamStore();

    await store.joinRun({ runId: "run-1", threadId: "thread-1" });

    expect(store.status).toBe("error");
    expect(store.errorMessage).toBe("retained tail expired");
    expect(store.activeThreadId).toBe("thread-1");
    expect(store.activeRunId).toBe("run-1");
    expect(store.viewModel.done).toBe(false);
  });

  it("stops an active run by cancelling and draining with the active ids", async () => {
    streamClientMocks.join.mockImplementation(async (options: JoinDeerFlowThreadStreamOptions) => {
      const owner = options.engine.startOwner();
      emit(options, owner, { runId: "run-1", threadId: "thread-1", type: "connected" });
      return { runId: "run-1", snapshot: options.engine.getSnapshot() };
    });
    streamClientMocks.cancel.mockImplementation(
      async (options: CancelDeerFlowThreadStreamOptions) => {
        const owner = options.engine.startOwner({ reset: false });
        emit(options, owner, { cursor: { eventId: "9" }, type: "done" });
        return { runId: "run-1", snapshot: options.engine.getSnapshot() };
      },
    );
    const store = useThreadStreamStore();

    await store.joinRun({ runId: "run-1", threadId: "thread-1" });
    await store.stop();

    expect(streamClientMocks.cancel).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", threadId: "thread-1" }),
    );
    expect(store.status).toBe("completed");
  });

  it("aborts an active run without draining when requested", async () => {
    let joinSignal: AbortSignal | undefined;
    let releaseJoin: (() => void) | undefined;
    streamClientMocks.join.mockImplementation(async (options: JoinDeerFlowThreadStreamOptions) => {
      joinSignal = options.signal;
      const owner = options.engine.startOwner();
      emit(options, owner, { runId: "run-1", threadId: "thread-1", type: "connected" });
      await new Promise<void>((resolve) => {
        releaseJoin = resolve;
      });
      return { runId: "run-1", snapshot: options.engine.getSnapshot() };
    });
    const store = useThreadStreamStore();

    const joinPromise = store.joinRun({ runId: "run-1", threadId: "thread-1" });
    await waitFor(() => Boolean(joinSignal));
    await store.stop({ drain: false });
    releaseJoin?.();
    await joinPromise;

    expect(joinSignal?.aborted).toBe(true);
    expect(streamClientMocks.cancel).not.toHaveBeenCalled();
    expect(store.status).toBe("aborted");
  });

  it("resets active ids, loaded history, and live snapshot", async () => {
    streamClientMocks.start.mockImplementation(async (options: StartDeerFlowThreadStreamOptions) => {
      const owner = options.engine.startOwner();
      emit(options, owner, { runId: "run-1", threadId: "thread-1", type: "connected" });
      emit(options, owner, {
        cursor: { eventId: "1" },
        type: "message_snapshot",
        values: { messages: [{ id: "a-1", type: "ai", content: "live" }] },
      });
      return { runId: "run-1", snapshot: options.engine.getSnapshot() };
    });
    const store = useThreadStreamStore();
    store.setHistoryMessages([{ id: "h-1", type: "human", content: "history" }]);

    await store.sendMessage({ text: "hello", threadId: "thread-1" });
    store.reset();

    expect(store.status).toBe("idle");
    expect(store.activeThreadId).toBeNull();
    expect(store.activeRunId).toBeNull();
    expect(store.errorMessage).toBeNull();
    expect(store.snapshot.values).toBeUndefined();
    expect(store.viewModel.messages).toEqual([]);
    expect(store.viewModel.messageCount).toBe(0);
  });
});

function emit(
  options:
    | StartDeerFlowThreadStreamOptions
    | JoinDeerFlowThreadStreamOptions
    | CancelDeerFlowThreadStreamOptions,
  owner: number,
  event: CanonicalStreamEvent,
): void {
  options.onEvent?.(event);
  options.engine.accept(owner, event);
}

async function waitFor(assertion: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (assertion()) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error("Timed out waiting for assertion.");
}
