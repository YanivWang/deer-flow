/*
  【文件职责】     固定open/download 预检与 Gateway 错误保真合同。
  【架构位置】     测试
  【主要导出】     probeArtifactAction 回归
  【依赖关系】     app/core/artifacts/actions.ts
  【边界与注意】   只证明 HTTP/action policy；浏览器窗口和下载点击由 DOM/E2E 证明。
*/

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ArtifactActionError,
  probeArtifactAction,
} from "@/core/artifacts/actions";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("probeArtifactAction", () => {
  it("uses the existing GET endpoint with a one-byte Range before opening or downloading", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("x", { status: 206 }));

    await probeArtifactAction("/api/threads/t/artifacts/file.pdf");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/threads/t/artifacts/file.pdf",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: { Range: "bytes=0-0" },
      }),
    );
  });

  it("accepts the Gateway empty-file Range response without hiding other 416 errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 416,
        headers: { "Content-Range": "bytes */0" },
      }),
    );

    await expect(probeArtifactAction("/empty.txt")).resolves.toBeUndefined();
  });

  it.each([403, 404, 413, 415, 416, 500])(
    "preserves Gateway %s detail instead of reporting success",
    async (status) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ detail: `gateway-${status}` }), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const error = await probeArtifactAction("/artifact").catch(
        (cause: unknown) => cause,
      );
      expect(error).toBeInstanceOf(ArtifactActionError);
      expect(error).toMatchObject({ status, message: `gateway-${status}` });
    },
  );
});
