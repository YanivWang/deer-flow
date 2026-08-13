/*
  【文件职责】     用一个非 LangGraph 的 sessions API 实现 RunProtocol。
  【对应 frontend/】 无；M8 consumer 示例
  【架构位置】     consumer L3 adapter
  【主要导出】     ExampleRunHandle · createExampleRunProtocol
  【依赖关系】     @deerflow/agent-core RunProtocol
  【边界与注意】   create 只 POST 一次；拿到 handle 后 resume 才允许重试。
*/

import { AgentStreamError } from "@deerflow/agent-core";
import type { RunProtocol } from "@deerflow/agent-core";

export interface ExampleRunHandle {
  sessionId: string;
}

export function createExampleRunProtocol(options: {
  baseUrl: string;
  fetch: typeof globalThis.fetch;
}): RunProtocol<{ prompt: string }, ExampleRunHandle> {
  const sessionUrl = (handle: ExampleRunHandle) =>
    `${options.baseUrl}/sessions/${encodeURIComponent(handle.sessionId)}`;

  return {
    async create(input, signal) {
      const response = await options.fetch(`${options.baseUrl}/sessions`, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const sessionId = response.headers.get("x-session-id");
      if (!sessionId) {
        throw new AgentStreamError("missing_handle", "missing x-session-id");
      }
      return { handle: { sessionId }, response };
    },
    resume(handle, cursor, signal) {
      return options.fetch(`${sessionUrl(handle)}/events`, {
        method: "GET",
        signal,
        ...(cursor ? { headers: { "last-event-id": cursor } } : {}),
      });
    },
    async cancel(handle, cursor, signal) {
      const response = await options.fetch(`${sessionUrl(handle)}/cancel`, {
        method: "POST",
        signal,
        ...(cursor ? { headers: { "last-event-id": cursor } } : {}),
      });
      return response.status === 202
        ? { kind: "accepted" }
        : { kind: "terminal", outcome: "cancelled" };
    },
    async inspect(handle, signal) {
      const response = await options.fetch(sessionUrl(handle), { signal });
      const body = (await response.json()) as { status: string };
      return body.status === "done"
        ? { terminal: true, outcome: "completed" }
        : { terminal: false };
    },
  };
}
