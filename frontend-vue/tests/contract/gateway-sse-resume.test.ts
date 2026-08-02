import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  joinDeerFlowThreadStream,
  startDeerFlowThreadStream,
} from "../../app/core/api/stream/client";
import { ThreadStreamEngine } from "../../app/core/api/stream/engine";
import type { CanonicalStreamEvent } from "../../app/core/api/stream/canonical";

const encoder = new TextEncoder();
const gatewayServicesSource = readRepositoryFile("backend/app/gateway/services.py");
const memoryBridgeSource = readRepositoryFile(
  "backend/packages/harness/deerflow/runtime/stream_bridge/memory.py",
);
const redisBridgeSource = readRepositoryFile(
  "backend/packages/harness/deerflow/runtime/stream_bridge/redis.py",
);
const vueStreamClientSource = readRepositoryFile("frontend-vue/app/core/api/stream/client.ts");

describe("Gateway SSE resume contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("anchors retained and dropped replay history semantics in the real Gateway sources", () => {
    expect(gatewayServicesSource).toContain('last_event_id = request.headers.get("Last-Event-ID")');
    expect(gatewayServicesSource).toContain("bridge.subscribe(record.run_id, last_event_id=last_event_id)");
    expect(gatewayServicesSource).toContain("if isinstance(entry, StreamGap):");
    expect(gatewayServicesSource).toContain('"code": "stream_replay_gap"');
    expect(gatewayServicesSource).toContain('"recovery": "reload_durable_state"');
    expect(gatewayServicesSource).toContain("gap_emitted = True");
    expect(memoryBridgeSource).toContain("seq < stream.start_offset");
    expect(memoryBridgeSource).toContain("return self._make_gap(stream, last_event_id)");
    expect(memoryBridgeSource).toContain("return stream.start_offset + local_index + 1");
    expect(redisBridgeSource).toContain("gap_detection_enabled = last_event_id is not None");
    expect(redisBridgeSource).toContain("if self._stream_id_lt(snapshot_stream_id, earliest_id):");
    expect(redisBridgeSource).toContain("yield StreamGap(");
    expect(vueStreamClientSource).toContain('nextHeaders.set("Last-Event-ID", lastEventId)');
    expect(vueStreamClientSource).toContain("fetchThreadStateValues");
    expect(vueStreamClientSource).toContain("lastEventId: gapEvent.gap.latest_available_event_id");
  });

  it("reloads durable thread state on replay gap and resumes from latest available event id", async () => {
    const observedEvents: CanonicalStreamEvent[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/threads/thread-1/runs/stream") {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toMatchObject({
          assistant_id: "lead_agent",
          on_disconnect: "cancel",
          stream_mode: ["values", "messages-tuple", "custom"],
        });
        return sseResponse({
          body: sse([
            {
              data: {
                code: "stream_replay_gap",
                earliest_available_event_id: "100",
                latest_available_event_id: "120",
                recovery: "reload_durable_state",
                requested_event_id: "99",
                run_id: "run-1",
              },
              event: "gap",
            },
          ]),
          contentLocation: "/api/threads/thread-1/runs/run-1",
        });
      }
      if (url === "/api/threads/thread-1/state") {
        expect(init?.method).toBe("GET");
        return Response.json({
          values: {
            messages: [{ id: "a-1", type: "ai", content: "restored durable state" }],
          },
        });
      }
      if (url === "/api/threads/thread-1/runs/run-1/join") {
        const headers = new Headers(init?.headers);
        expect(init?.method).toBe("GET");
        expect(headers.get("Last-Event-ID")).toBe("120");
        return sseResponse({
          body: sse([
            {
              data: { id: "duplicate", type: "ai", content: "should be ignored" },
              event: "messages",
              id: "120",
            },
            {
              data: { id: "a-2", type: "ai", content: "joined tail" },
              event: "messages",
              id: "121",
            },
            { data: null, event: "end", id: "122" },
          ]),
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const engine = new ThreadStreamEngine();

    const result = await startDeerFlowThreadStream({
      engine,
      input: { messages: [{ type: "human", content: "resume please" }] },
      onEvent: (event) => observedEvents.push(event),
      threadId: "thread-1",
    });

    expect(result.runId).toBe("run-1");
    expect(result.snapshot.gapCount).toBe(1);
    expect(result.snapshot.values).toEqual({
      messages: [{ id: "a-1", type: "ai", content: "restored durable state" }],
    });
    expect(result.snapshot.messageDeltas).toEqual([
      { id: "a-2", type: "ai", content: "joined tail" },
    ]);
    expect(result.snapshot.cursor).toBe("122");
    expect(result.snapshot.done).toBe(true);
    expect(observedEvents.map((event) => event.type)).toEqual([
      "connected",
      "stream_gap",
      "message_snapshot",
      "message_delta",
      "message_delta",
      "done",
    ]);
  });

  it("recovers dropped history while joining an existing run", async () => {
    const observedEvents: CanonicalStreamEvent[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/threads/thread-1/runs/run-1/join") {
        const headers = new Headers(init?.headers);
        expect(init?.method).toBe("GET");
        if (headers.get("Last-Event-ID") === "90") {
          return sseResponse({
            body: sse([
              {
                data: {
                  code: "stream_replay_gap",
                  earliest_available_event_id: "100",
                  latest_available_event_id: "120",
                  recovery: "reload_durable_state",
                  requested_event_id: "90",
                  run_id: "run-1",
                },
                event: "gap",
              },
            ]),
          });
        }
        expect(headers.get("Last-Event-ID")).toBe("120");
        return sseResponse({
          body: sse([
            {
              data: { id: "a-2", type: "ai", content: "retained tail after gap" },
              event: "messages",
              id: "121",
            },
            { data: null, event: "end", id: "122" },
          ]),
        });
      }
      if (url === "/api/threads/thread-1/state") {
        expect(init?.method).toBe("GET");
        return Response.json({
          values: {
            messages: [{ id: "a-1", type: "ai", content: "durable join recovery" }],
          },
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const engine = new ThreadStreamEngine();

    const result = await joinDeerFlowThreadStream({
      engine,
      lastEventId: "90",
      onEvent: (event) => observedEvents.push(event),
      runId: "run-1",
      threadId: "thread-1",
    });

    expect(result.snapshot.gapCount).toBe(1);
    expect(result.snapshot.values).toEqual({
      messages: [{ id: "a-1", type: "ai", content: "durable join recovery" }],
    });
    expect(result.snapshot.messageDeltas).toEqual([
      { id: "a-2", type: "ai", content: "retained tail after gap" },
    ]);
    expect(result.snapshot.cursor).toBe("122");
    expect(result.snapshot.done).toBe(true);
    expect(observedEvents.map((event) => event.type)).toEqual([
      "connected",
      "stream_gap",
      "message_snapshot",
      "message_delta",
      "done",
    ]);
  });
});

function sseResponse({
  body,
  contentLocation,
}: {
  body: string;
  contentLocation?: string;
}): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
    {
      headers: {
        ...(contentLocation ? { "Content-Location": contentLocation } : {}),
        "Content-Type": "text/event-stream",
      },
      status: 200,
    },
  );
}

function sse(events: Array<{ data: unknown; event: string; id?: string }>): string {
  return `${events
    .map((event) =>
      [
        `event: ${event.event}`,
        ...(event.id ? [`id: ${event.id}`] : []),
        `data: ${JSON.stringify(event.data)}`,
        "",
      ].join("\n"),
    )
    .join("\n")}\n`;
}

function readRepositoryFile(path: string) {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../..", path), "utf8");
}
