/*
  【文件职责】     WP-06 open/download 前的 Gateway 可访问性预检与错误保真。
  【架构位置】     L3
  【主要导出】     ArtifactActionError / probeArtifactAction
  【依赖关系】     core/api/fetcher
  【边界与注意】   只读取一字节，不消费完整二进制；实际打开和下载仍由浏览器 UI 边界完成。
*/

import { fetch } from "@/core/api/fetcher";

export class ArtifactActionError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ArtifactActionError";
    this.status = status;
  }
}

async function readErrorDetail(response: Response) {
  const data = (await response.json().catch(() => ({}))) as {
    detail?: unknown;
  };
  return typeof data.detail === "string"
    ? data.detail
    : `HTTP ${response.status}: ${response.statusText}`;
}

export async function probeArtifactAction(url: string, signal?: AbortSignal) {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { Range: "bytes=0-0" },
    signal,
  });
  if (
    response.status === 416 &&
    response.headers.get("Content-Range") === "bytes */0"
  ) {
    return;
  }
  if (!response.ok) {
    throw new ArtifactActionError(
      response.status,
      await readErrorDetail(response),
    );
  }
}
