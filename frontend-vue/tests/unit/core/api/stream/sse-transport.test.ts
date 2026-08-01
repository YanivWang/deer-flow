import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchSse,
  parseSseText,
} from "../../../../../app/core/api/stream/transport/fetch-sse";

async function collect(chunks: string[]) {
  async function* source() {
    for (const chunk of chunks) {
      yield chunk;
    }
  }
  const frames = [];
  for await (const frame of parseSseText(source())) {
    frames.push(frame);
  }
  return frames;
}

describe("SSE transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses CRLF, id, heartbeat, multiline data, and EOF remainder", async () => {
    const frames = await collect([
      ": heartbeat\r\n\r\n",
      "event: values\r\nid: 1\r\ndata: {\"a\":",
      "1}\r\n\r\n",
      "event: custom\ndata: line 1\ndata: line 2\n\n",
      "event: end\ndata: null\nid: 2",
    ]);

    expect(frames).toEqual([
      { kind: "heartbeat", comment: "heartbeat" },
      { kind: "event", event: { event: "values", id: "1", data: "{\"a\":1}" } },
      { kind: "event", event: { event: "custom", data: "line 1\nline 2" } },
      { kind: "event", event: { event: "end", id: "2", data: "null" } },
    ]);
  });

  it("preserves caller Headers instances while adding the SSE Accept header", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("event: end\nid: 8\ndata: null\n\n"));
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const frames = [];
    for await (const frame of fetchSse("/api/events", {
      headers: new Headers({
        "Last-Event-ID": "7",
        "X-Request-ID": "request-a",
      }),
    })) {
      frames.push(frame);
    }

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get("Accept")).toBe("text/event-stream");
    expect(headers.get("Last-Event-ID")).toBe("7");
    expect(headers.get("X-Request-ID")).toBe("request-a");
    expect(frames).toEqual([
      { kind: "event", event: { data: "null", event: "end", id: "8" } },
    ]);
  });
});
