import { appendCsrfHeader } from "../api/csrf";

import { adaptDeerFlowGatewayEvent } from "./adapters/deerflow-gateway";
import type { CanonicalStreamEvent } from "../protocol/stream/canonical";
import {
  decodeDeerFlowWireEvent,
  parseRunIdFromContentLocation,
} from "../protocol/stream/codec/deerflow-wire";
import type { ThreadStreamEngine } from "./engine";
import { canRecoverGap } from "./gap-recovery";
import type { StreamSnapshot } from "./reducer";
import { fetchSse } from "./transport/fetch-sse";
import type { SseFrame } from "./transport/sse-event";
import { StreamEngineError } from "./transport/stream-error";

export type DeerFlowRunInput = {
  messages?: unknown[];
  [key: string]: unknown;
};

export type StartDeerFlowThreadStreamOptions = {
  threadId: string;
  input: DeerFlowRunInput;
  engine: ThreadStreamEngine;
  assistantId?: string;
  context?: Record<string, unknown>;
  checkpoint?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  endpointBase?: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
  onEvent?: (event: CanonicalStreamEvent) => void;
};

export type DeerFlowThreadStreamResult = {
  runId?: string;
  snapshot: StreamSnapshot;
};

export type JoinDeerFlowThreadStreamOptions = {
  threadId: string;
  runId: string;
  engine: ThreadStreamEngine;
  endpointBase?: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
  lastEventId?: string;
  reset?: boolean;
  onEvent?: (event: CanonicalStreamEvent) => void;
};

export type CancelDeerFlowThreadStreamOptions = {
  threadId: string;
  runId: string;
  engine: ThreadStreamEngine;
  endpointBase?: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
  action?: "interrupt" | "rollback";
  onEvent?: (event: CanonicalStreamEvent) => void;
};

const DEFAULT_STREAM_MODE = ["values", "messages-tuple", "custom"] as const;

export async function startDeerFlowThreadStream({
  threadId,
  input,
  engine,
  assistantId = "lead_agent",
  context,
  checkpoint,
  metadata,
  endpointBase = "",
  signal,
  headers,
  onEvent,
}: StartDeerFlowThreadStreamOptions): Promise<DeerFlowThreadStreamResult> {
  const owner = engine.startOwner();
  let runId: string | undefined;

  try {
    const source = fetchSse(
      buildThreadStreamUrl(endpointBase, threadId),
      {
        body: JSON.stringify({
          assistant_id: assistantId,
          input,
          context,
          ...(checkpoint ? { checkpoint } : {}),
          ...(metadata ? { metadata } : {}),
          stream_mode: DEFAULT_STREAM_MODE,
          on_disconnect: "cancel",
          multitask_strategy: "reject",
        }),
        headers: buildStreamHeaders(headers, "POST"),
        method: "POST",
        signal,
      },
      {
        onResponse(response) {
          runId = parseRunIdFromContentLocation(response.headers.get("Content-Location"));
          const event = { type: "connected", runId, threadId } satisfies CanonicalStreamEvent;
          onEvent?.(event);
          engine.accept(owner, event);
        },
      },
    );
    await consumeDeerFlowStream({
      engine,
      endpointBase,
      headers,
      onEvent,
      owner,
      runId: () => runId,
      signal,
      source,
      threadId,
    });
  } catch (error) {
    if (signal?.aborted) {
      engine.accept(owner, { type: "aborted" });
      return { runId, snapshot: engine.getSnapshot() };
    }
    const streamError =
      error instanceof StreamEngineError
        ? error
        : new StreamEngineError("network", "DeerFlow 流失败。", error);
    engine.accept(owner, { type: "error", error: streamError });
    throw streamError;
  }

  return { runId, snapshot: engine.getSnapshot() };
}

export async function joinDeerFlowThreadStream({
  threadId,
  runId,
  engine,
  endpointBase = "",
  signal,
  headers,
  lastEventId,
  reset = true,
  onEvent,
}: JoinDeerFlowThreadStreamOptions): Promise<DeerFlowThreadStreamResult> {
  const owner = engine.startOwner({ reset });

  try {
    const connected = { type: "connected", runId, threadId } satisfies CanonicalStreamEvent;
    onEvent?.(connected);
    engine.accept(owner, connected);
    await consumeDeerFlowStream({
      engine,
      endpointBase,
      headers,
      onEvent,
      owner,
      runId: () => runId,
      signal,
      source: fetchJoinStream({
        endpointBase,
        headers,
        lastEventId,
        runId,
        signal,
        threadId,
      }),
      threadId,
    });
  } catch (error) {
    if (signal?.aborted) {
      engine.accept(owner, { type: "aborted" });
      return { runId, snapshot: engine.getSnapshot() };
    }
    const streamError =
      error instanceof StreamEngineError
        ? error
        : new StreamEngineError("network", "DeerFlow 续接流失败。", error);
    engine.accept(owner, { type: "error", error: streamError });
    throw streamError;
  }

  return { runId, snapshot: engine.getSnapshot() };
}

export async function cancelDeerFlowThreadStream({
  threadId,
  runId,
  engine,
  endpointBase = "",
  signal,
  headers,
  action = "interrupt",
  onEvent,
}: CancelDeerFlowThreadStreamOptions): Promise<DeerFlowThreadStreamResult> {
  const owner = engine.startOwner({ reset: false });

  try {
    await consumeDeerFlowStream({
      engine,
      endpointBase,
      headers,
      onEvent,
      owner,
      runId: () => runId,
      signal,
      source: fetchSse(
        buildCancelAndDrainUrl(endpointBase, threadId, runId, action),
        {
          headers: buildStreamHeaders(headers, "POST"),
          method: "POST",
          signal,
        },
      ),
      threadId,
    });
  } catch (error) {
    if (isRunNotCancellableError(error)) {
      return { runId, snapshot: engine.getSnapshot() };
    }
    if (signal?.aborted) {
      engine.accept(owner, { type: "aborted" });
      return { runId, snapshot: engine.getSnapshot() };
    }
    const streamError =
      error instanceof StreamEngineError
        ? error
        : new StreamEngineError("network", "DeerFlow 取消流失败。", error);
    engine.accept(owner, { type: "error", error: streamError });
    throw streamError;
  }

  return { runId, snapshot: engine.getSnapshot() };
}

async function consumeDeerFlowStream({
  engine,
  endpointBase,
  headers,
  onEvent,
  owner,
  runId,
  signal,
  source,
  threadId,
}: {
  engine: ThreadStreamEngine;
  endpointBase: string;
  headers?: HeadersInit;
  onEvent?: (event: CanonicalStreamEvent) => void;
  owner: number;
  runId: () => string | undefined;
  signal?: AbortSignal;
  source: AsyncIterable<SseFrame>;
  threadId: string;
}): Promise<void> {
  let activeSource = source;
  let recoveryAttempts = 0;

  while (true) {
    let gapEvent: Extract<CanonicalStreamEvent, { type: "stream_gap" }> | undefined;
    for await (const frame of activeSource) {
      if (frame.kind === "heartbeat") {
        continue;
      }
      const event = adaptDeerFlowGatewayEvent(decodeDeerFlowWireEvent(frame.event));
      onEvent?.(event);
      engine.accept(owner, event);
      if (event.type === "stream_gap") {
        gapEvent = event;
        break;
      }
    }

    if (!gapEvent) {
      return;
    }

    const activeRunId = runId() ?? gapEvent.gap.run_id;
    if (gapEvent.gap.run_id !== activeRunId) {
      throw new StreamEngineError("gap", "流重放缺口与当前运行不匹配。");
    }
    if (!canRecoverGap(recoveryAttempts)) {
      throw new StreamEngineError(
        "gap",
        `尝试 ${recoveryAttempts} 次后仍无法恢复 SSE 历史。`,
      );
    }
    recoveryAttempts += 1;

    const durableValues = await fetchThreadStateValues({
      endpointBase,
      headers,
      signal,
      threadId,
    });
    const durableEvent = {
      type: "message_snapshot",
      values: durableValues,
      cursor: { eventId: gapEvent.gap.latest_available_event_id },
    } satisfies CanonicalStreamEvent;
    onEvent?.(durableEvent);
    engine.accept(owner, durableEvent);

    activeSource = fetchJoinStream({
      endpointBase,
      headers,
      lastEventId: gapEvent.gap.latest_available_event_id,
      runId: activeRunId,
      signal,
      threadId,
    });
  }
}

function fetchJoinStream({
  endpointBase,
  headers,
  lastEventId,
  runId,
  signal,
  threadId,
}: {
  endpointBase: string;
  headers?: HeadersInit;
  lastEventId?: string;
  runId: string;
  signal?: AbortSignal;
  threadId: string;
}): AsyncGenerator<SseFrame> {
  const nextHeaders = buildStreamHeaders(headers, "GET");
  if (lastEventId) {
    nextHeaders.set("Last-Event-ID", lastEventId);
  }
  return fetchSse(buildJoinStreamUrl(endpointBase, threadId, runId), {
    headers: nextHeaders,
    method: "GET",
    signal,
  });
}

async function fetchThreadStateValues({
  endpointBase,
  headers,
  signal,
  threadId,
}: {
  endpointBase: string;
  headers?: HeadersInit;
  signal?: AbortSignal;
  threadId: string;
}): Promise<unknown> {
  const response = await fetch(buildThreadStateUrl(endpointBase, threadId), {
    headers: buildStreamHeaders(headers, "GET"),
    method: "GET",
    signal,
  });
  if (!response.ok) {
    throw new StreamEngineError(
      "backend",
      `对话状态请求失败，HTTP ${response.status}`,
      response,
    );
  }
  const payload = (await response.json()) as unknown;
  if (typeof payload === "object" && payload !== null && "values" in payload) {
    return Reflect.get(payload, "values");
  }
  return payload;
}

function buildThreadStreamUrl(endpointBase: string, threadId: string): string {
  const prefix = endpointBase.replace(/\/$/, "");
  return `${prefix}/api/langgraph/threads/${encodeURIComponent(threadId)}/runs/stream`;
}

function buildJoinStreamUrl(endpointBase: string, threadId: string, runId: string): string {
  const prefix = endpointBase.replace(/\/$/, "");
  return `${prefix}/api/langgraph/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}/join`;
}

function buildCancelAndDrainUrl(
  endpointBase: string,
  threadId: string,
  runId: string,
  action: "interrupt" | "rollback",
): string {
  const prefix = endpointBase.replace(/\/$/, "");
  return `${prefix}/api/langgraph/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}/stream?action=${action}`;
}

function buildThreadStateUrl(endpointBase: string, threadId: string): string {
  const prefix = endpointBase.replace(/\/$/, "");
  return `${prefix}/api/langgraph/threads/${encodeURIComponent(threadId)}/state`;
}

function buildStreamHeaders(headers: HeadersInit | undefined, method: string): Headers {
  const nextHeaders = new Headers(headers);
  nextHeaders.set("Content-Type", "application/json");
  return appendCsrfHeader(nextHeaders, method);
}

function isRunNotCancellableError(error: unknown): boolean {
  const cause = error instanceof StreamEngineError ? error.cause : error;
  const response = cause instanceof Response ? cause : undefined;
  return response?.status === 409;
}
