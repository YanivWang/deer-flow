import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cancelDeerFlowThreadStream,
  joinDeerFlowThreadStream,
  startDeerFlowThreadStream,
} from "../../../../app/core/stream/client";
import { ThreadStreamEngine } from "../../../../app/core/stream/engine";

const encoder = new TextEncoder();

function streamResponse(body: string): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
    {
      headers: {
        "Content-Location": "/api/langgraph/threads/thread-1/runs/run-1",
        "Content-Type": "text/event-stream",
      },
      status: 200,
    },
  );
}

describe("DeerFlow thread stream client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the Gateway stream endpoint and updates the engine snapshot", async () => {
    vi.stubGlobal("document", { cookie: "csrf_token=stream-token" });
    const fetchMock = vi.fn(async () =>
      streamResponse(
        [
          "event: values",
          "id: 1",
          'data: {"messages":[{"type":"ai","content":"hello"}]}',
          "",
          "event: custom",
          "id: 2",
          'data: {"type":"task_running","task_id":"search"}',
          "",
          "event: end",
          "id: 3",
          "data: null",
          "",
          "",
        ].join("\n"),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const engine = new ThreadStreamEngine();

    const result = await startDeerFlowThreadStream({
      engine,
      input: { messages: [{ type: "human", content: "hi" }] },
      threadId: "thread-1",
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/langgraph/threads/thread-1/runs/stream",
      expect.objectContaining({ method: "POST" }),
    );
    expect(headers.get("X-CSRF-Token")).toBe("stream-token");
    expect(result.runId).toBe("run-1");
    expect(result.snapshot.values).toEqual({
      messages: [{ type: "ai", content: "hello" }],
    });
    expect(result.snapshot.subtasks).toEqual([{ type: "task_running", task_id: "search" }]);
    expect(result.snapshot.done).toBe(true);
  });

  it("joins an existing run with Last-Event-ID", async () => {
    vi.stubGlobal("document", { cookie: "csrf_token=stream-token" });
    const fetchMock = vi.fn(async () =>
      streamResponse(["event: end", "id: 8", "data: null", "", ""].join("\n")),
    );
    vi.stubGlobal("fetch", fetchMock);
    const engine = new ThreadStreamEngine();

    await joinDeerFlowThreadStream({
      engine,
      lastEventId: "7",
      runId: "run-1",
      threadId: "thread-1",
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/langgraph/threads/thread-1/runs/run-1/join",
      expect.objectContaining({ method: "GET" }),
    );
    expect(headers.get("Last-Event-ID")).toBe("7");
    expect(headers.has("X-CSRF-Token")).toBe(false);
    expect(engine.getSnapshot().done).toBe(true);
  });

  it("preserves caller headers when joining with Last-Event-ID", async () => {
    const fetchMock = vi.fn(async () =>
      streamResponse(["event: end", "id: 12", "data: null", "", ""].join("\n")),
    );
    vi.stubGlobal("fetch", fetchMock);
    const engine = new ThreadStreamEngine();

    await joinDeerFlowThreadStream({
      engine,
      headers: new Headers({ Authorization: "Bearer token-a" }),
      lastEventId: "11",
      runId: "run-1",
      threadId: "thread-1",
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-a");
    expect(headers.get("Last-Event-ID")).toBe("11");
    expect(headers.get("Accept")).toBe("text/event-stream");
  });

  it("recovers a replay gap through durable state and join tail", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/runs/stream")) {
        return streamResponse(
          [
            "event: gap",
            'data: {"code":"stream_replay_gap","run_id":"run-1","requested_event_id":"99","earliest_available_event_id":"100","latest_available_event_id":"120","recovery":"reload_durable_state"}',
            "",
            "",
          ].join("\n"),
        );
      }
      if (url.endsWith("/state")) {
        return Response.json({
          values: { messages: [{ id: "a-1", type: "ai", content: "restored" }] },
        });
      }
      return streamResponse(["event: end", "id: 121", "data: null", "", ""].join("\n"));
    });
    vi.stubGlobal("fetch", fetchMock);
    const engine = new ThreadStreamEngine();

    const result = await startDeerFlowThreadStream({
      engine,
      input: { messages: [{ type: "human", content: "hi" }] },
      threadId: "thread-1",
    });

    const joinCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/join"));
    const joinHeaders = new Headers(joinCall?.[1]?.headers);
    expect(result.snapshot.gapCount).toBe(1);
    expect(result.snapshot.values).toEqual({
      messages: [{ id: "a-1", type: "ai", content: "restored" }],
    });
    expect(joinHeaders.get("Last-Event-ID")).toBe("120");
    expect(result.snapshot.done).toBe(true);
  });

  it("requests cancel and drains the existing run stream", async () => {
    const fetchMock = vi.fn(async () =>
      streamResponse(["event: end", "id: 9", "data: null", "", ""].join("\n")),
    );
    vi.stubGlobal("fetch", fetchMock);
    const engine = new ThreadStreamEngine();

    await cancelDeerFlowThreadStream({
      engine,
      runId: "run-1",
      threadId: "thread-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/langgraph/threads/thread-1/runs/run-1/stream?action=interrupt",
      expect.objectContaining({ method: "POST" }),
    );
    expect(engine.getSnapshot().done).toBe(true);
  });
});
