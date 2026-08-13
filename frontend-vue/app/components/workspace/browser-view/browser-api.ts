/*
  【文件职责】     构造 browser-view REST/WS 地址与输入请求。
  【对应 frontend/】 src/components/workspace/browser-view/api.ts
  【架构位置】     L3
  【主要导出】     browser API helpers
  【依赖关系】     runtime config · Gateway thread endpoint
  【边界与注意】   认识 DeerFlow endpoint，禁止进入 L1/L2。
*/

import { getBackendBaseURL } from "@/core/config";

export function browserStreamURL(threadId: string, seedUrl?: string): string {
  const base =
    getBackendBaseURL() ||
    (typeof window === "undefined" ? "" : window.location.origin);
  const query = new URLSearchParams({ frame_format: "binary" });
  if (seedUrl) query.set("seed", seedUrl);
  return `${base.replace(/^http/i, "ws")}/api/threads/${encodeURIComponent(threadId)}/browser/stream?${query}`;
}
