import { flushSseRemainder, readNextSseFrame } from "./sse-buffer";
import { parseSseFrame } from "./parse-sse-event";
import type { SseFrame } from "./sse-event";
import { StreamEngineError } from "./stream-error";

export async function* parseSseText(chunks: AsyncIterable<string>): AsyncGenerator<SseFrame> {
  let buffer = "";

  for await (const chunk of chunks) {
    buffer += chunk;
    while (true) {
      const result = readNextSseFrame(buffer);
      if (!result) {
        break;
      }
      buffer = result.remaining;
      const parsed = parseSseFrame(result.frame);
      if (parsed) {
        yield parsed;
      }
    }
  }

  const remainder = flushSseRemainder(buffer);
  if (remainder) {
    const parsed = parseSseFrame(remainder);
    if (parsed) {
      yield parsed;
    }
  }
}

export async function* fetchSse(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: { onResponse?: (response: Response) => void } = {},
): AsyncGenerator<SseFrame> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "text/event-stream");
  const response = await fetch(input, {
    ...init,
    headers,
  });
  options.onResponse?.(response);

  const body = response.body;
  if (!response.ok) {
    throw new StreamEngineError(
      "backend",
      `SSE 请求失败，HTTP ${response.status}`,
      response,
    );
  }
  if (!body) {
    return;
  }

  const streamBody = body;
  const decoder = new TextDecoder();
  async function* decode(): AsyncGenerator<string> {
    const reader = streamBody.getReader();
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) {
          break;
        }
        yield decoder.decode(next.value, { stream: true });
      }
      const tail = decoder.decode();
      if (tail) {
        yield tail;
      }
    } finally {
      reader.releaseLock();
    }
  }

  yield* parseSseText(decode());
}
