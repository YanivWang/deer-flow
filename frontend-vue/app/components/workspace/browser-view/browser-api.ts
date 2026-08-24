/*
  【文件职责】     构造 browser-view REST/WS 地址与输入请求。
  【架构位置】     L3
  【主要导出】     browser API helpers
  【依赖关系】     runtime config · Gateway thread endpoint
  【边界与注意】   认识 DeerFlow endpoint，禁止进入 L1/L2。
*/

import { getBackendBaseURL } from "@/core/config";
import { throwGatewayApiError } from "@/core/api/errors";
import { fetch } from "@/core/api/fetcher";
import type { components } from "@/core/api/types.gen";

export type BrowserNavigateResult =
  components["schemas"]["BrowserNavigateResponse"];

export async function navigateBrowser(
  threadId: string,
  url: string,
  options: { signal?: AbortSignal } = {},
): Promise<BrowserNavigateResult> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/browser/navigate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: options.signal,
    },
  );
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to navigate browser: ${response.statusText}`,
    );
  }
  return (await response.json()) as BrowserNavigateResult;
}

export function browserStreamURL(threadId: string, seedUrl?: string): string {
  const base =
    getBackendBaseURL() ||
    (typeof window === "undefined" ? "" : window.location.origin);
  const query = new URLSearchParams({ frame_format: "binary" });
  if (seedUrl) query.set("seed", seedUrl);
  return `${base.replace(/^http/i, "ws")}/api/threads/${encodeURIComponent(threadId)}/browser/stream?${query}`;
}
