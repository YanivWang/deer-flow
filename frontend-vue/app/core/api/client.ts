/*
  【文件职责】     替代 LangGraph SDK `Client` 的 8 个 REST 方法（02 §249）。
  【架构位置】     L3
  【主要导出】     DeerFlowApiClient · createDeerFlowApiClient
  【依赖关系】     @/core/api/fetcher · @/core/api/errors · @/core/threads/types
  【边界与注意】   **URL 前缀保持 `/api/langgraph/*`**（02）。移除的是 SDK，不是
                   路由约定——前缀是 nginx 侧 SSE 超时与 body 上限的挂载点，
                   也是 E2E `mock-api.ts` 的拦截依据。改前缀不是重构，是改部署契约。

                   只实现 core 里**真正被调用**的方法（实测调用点见 02 §106：
                   threads.create/search/get/getState/delete/updateState、runs.list/get）。
                   SDK 还有几十个方法，照着补一遍等于把 4.7 MB 的接口面重新长出来，
                   而多出来的每一个都是没有测试、没有调用方的猜测。

                   CSRF 与 credentials 不在这里做——`fetcher.ts` 已经是那件事的
                   唯一实现，它同时服务 REST 与直连 endpoint。在这里再写一遍，
                   两份实现迟早会在 cookie 轮换上分叉。
*/

import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { throwGatewayResponseError } from "@/core/api/errors";
import type { AgentThread, AgentThreadState } from "@/core/threads/types";
import type { ThreadSearchQuery } from "@/core/types/message";

export interface DeerFlowRun {
  run_id: string;
  thread_id: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface DeerFlowApiClient {
  threads: {
    create(input?: {
      threadId?: string;
      assistantId?: string;
      metadata?: Record<string, unknown>;
    }): Promise<AgentThread>;
    search(query?: ThreadSearchQuery<AgentThreadState>): Promise<AgentThread[]>;
    get(threadId: string): Promise<AgentThread>;
    getState(threadId: string): Promise<{ values: AgentThreadState }>;
    updateState(
      threadId: string,
      update: { values: Partial<AgentThreadState> },
    ): Promise<void>;
    delete(threadId: string): Promise<void>;
  };
  runs: {
    list(threadId: string): Promise<DeerFlowRun[]>;
    get(threadId: string, runId: string): Promise<DeerFlowRun>;
  };
}

export interface DeerFlowApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetchWithAuth;
}

/**
 * `search` 的 query 里 `signal` 是**传输参数不是过滤条件**，必须拆出来。
 * 连它一起 JSON.stringify 会得到 `"signal": {}`，后端把它当成一个未知过滤字段。
 */
function splitSearchQuery(query: ThreadSearchQuery<AgentThreadState> = {}): {
  signal: AbortSignal | undefined;
  body: Record<string, unknown>;
} {
  const { signal, ...body } = query;
  return { signal, body: body as Record<string, unknown> };
}

export function createDeerFlowApiClient(
  options: DeerFlowApiClientOptions,
): DeerFlowApiClient {
  const { baseUrl, fetchImpl = fetchWithAuth } = options;
  const base = baseUrl.replace(/\/+$/, "");
  const threadUrl = (threadId: string) =>
    `${base}/threads/${encodeURIComponent(threadId)}`;

  async function request<T>(
    url: string,
    init: RequestInit,
    fallback: string,
  ): Promise<T> {
    const response = await fetchImpl(url, init);
    if (!response.ok) await throwGatewayResponseError(response, fallback);
    // 204 与空 body 都不能喂给 json()：SyntaxError 会把「删除成功」报成失败。
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  const json = { "Content-Type": "application/json" };

  return {
    threads: {
      create(input = {}) {
        return request<AgentThread>(
          `${base}/threads`,
          {
            method: "POST",
            headers: json,
            body: JSON.stringify({
              ...(input.threadId ? { thread_id: input.threadId } : {}),
              ...(input.assistantId ? { assistant_id: input.assistantId } : {}),
              metadata: input.metadata ?? {},
            }),
          },
          "Failed to create thread.",
        );
      },
      search(query) {
        const { signal, body } = splitSearchQuery(query);
        return request<AgentThread[]>(
          `${base}/threads/search`,
          {
            method: "POST",
            headers: json,
            body: JSON.stringify(body),
            ...(signal ? { signal } : {}),
          },
          "Failed to search threads.",
        );
      },
      get(threadId) {
        return request<AgentThread>(
          threadUrl(threadId),
          { method: "GET" },
          "Failed to load thread.",
        );
      },
      getState(threadId) {
        return request<{ values: AgentThreadState }>(
          `${threadUrl(threadId)}/state`,
          { method: "GET" },
          "Failed to load thread state.",
        );
      },
      async updateState(threadId, update) {
        // 这两个是 `Promise<void>`，所以**不能**写成 `request<void>`：
        // `void` 当泛型实参会被 @typescript-eslint/no-invalid-void-type 拦下。
        // 包一层 async 函数，返回值自然被丢弃。
        await request<unknown>(
          `${threadUrl(threadId)}/state`,
          { method: "POST", headers: json, body: JSON.stringify(update) },
          "Failed to update thread state.",
        );
      },
      async delete(threadId) {
        await request<unknown>(
          threadUrl(threadId),
          { method: "DELETE" },
          "Failed to delete thread.",
        );
      },
    },
    runs: {
      list(threadId) {
        return request<DeerFlowRun[]>(
          `${threadUrl(threadId)}/runs`,
          { method: "GET" },
          "Failed to list runs.",
        );
      },
      get(threadId, runId) {
        return request<DeerFlowRun>(
          `${threadUrl(threadId)}/runs/${encodeURIComponent(runId)}`,
          { method: "GET" },
          "Failed to load run.",
        );
      },
    },
  };
}
