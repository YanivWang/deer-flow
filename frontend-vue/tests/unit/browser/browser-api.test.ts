/*
  【文件职责】     固定 Vue browser REST fallback 的真实 Gateway path/body/response/error 合同。
  【架构位置】     测试
  【主要导出】     无；Vitest cases
  【依赖关系】     browser-api.ts · GatewayResponseError
  【边界与注意】   mock HTTP transport；真实 Gateway 证明由 m6-real-backend 负责。
*/

import { beforeEach, describe, expect, it, vi } from "vitest";

import { navigateBrowser } from "@/components/workspace/browser-view/browser-api";
import { GatewayResponseError } from "@/core/api/errors";

const fetchWithAuth = vi.hoisted(() => vi.fn());

vi.mock("@/core/api/fetcher", () => ({ fetch: fetchWithAuth }));
vi.mock("@/core/config", () => ({
  getBackendBaseURL: () => "https://gateway.example",
}));

describe("navigateBrowser", () => {
  beforeEach(() => {
    fetchWithAuth.mockReset();
  });

  it("posts only the OpenAPI url field to the encoded thread endpoint", async () => {
    const signal = new AbortController().signal;
    fetchWithAuth.mockResolvedValue(
      new Response(
        JSON.stringify({
          screenshot: "/mnt/user-data/outputs/.browser-frames/final.png",
          url: "https://resolved.example/final",
          title: "Resolved title",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      navigateBrowser("thread / one", "https://target.example", { signal }),
    ).resolves.toEqual({
      screenshot: "/mnt/user-data/outputs/.browser-frames/final.png",
      url: "https://resolved.example/final",
      title: "Resolved title",
    });
    expect(fetchWithAuth).toHaveBeenCalledWith(
      "https://gateway.example/api/threads/thread%20%2F%20one/browser/navigate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://target.example" }),
        signal,
      },
    );
  });

  it("preserves Gateway status and detail for retryable visible errors", async () => {
    fetchWithAuth.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Browser navigation failed" }), {
        status: 502,
        statusText: "Bad Gateway",
      }),
    );

    const error = await navigateBrowser(
      "thread-a",
      "https://target.example",
    ).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(GatewayResponseError);
    expect(error).toMatchObject({
      status: 502,
      message: "Browser navigation failed",
      body: { detail: "Browser navigation failed" },
    });
  });
});
