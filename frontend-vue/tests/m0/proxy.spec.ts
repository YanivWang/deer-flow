/*
  【文件职责】     验证 production preview 的 rewrite、流式响应、请求流和 headers。
  【对应 frontend/】 frontend/next.config.js
  【架构位置】     测试
  【主要导出】     @proxy Playwright cases
  【依赖关系】     使用 proxy-probe + Nuxt preview
  【边界与注意】   不把 probe 结果描述成真实 Gateway 证据。
*/

import { request as httpRequest } from "node:http";
import { expect, test } from "@playwright/test";

type RawResponse = {
  status: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
  firstChunkMs: number;
  endMs: number;
};

function rawRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
  } = {},
) {
  const started = Date.now();
  return new Promise<RawResponse>((resolve, reject) => {
    const request = httpRequest(
      `http://127.0.0.1:3101${path}`,
      { method: options.method ?? "GET", headers: options.headers },
      (response) => {
        response.setEncoding("utf8");
        let body = "";
        let firstChunkMs = -1;
        response.on("data", (chunk) => {
          if (firstChunkMs < 0) firstChunkMs = Date.now() - started;
          body += chunk;
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            body,
            headers: response.headers,
            firstChunkMs,
            endMs: Date.now() - started,
          }),
        );
      },
    );
    request.on("error", reject);
    request.end(options.body);
  });
}

test("@proxy rewrites both API prefixes and preserves response headers", async ({
  request,
}) => {
  const generic = await request.get("/api/features");
  expect(generic.status()).toBe(200);
  expect(await generic.json()).toEqual({
    source: "proxy-probe",
    path: "/api/features",
  });

  const specific = await rawRequest("/api/langgraph/probe/headers");
  expect(specific.status).toBe(307);
  expect(specific.headers["content-location"]).toBe(
    "/api/threads/redacted/runs/redacted",
  );
  expect(specific.headers.location).toBe("/api/redirect-target");
});

for (const ending of ["lf", "crlf"] as const) {
  test(`@proxy streams ${ending.toUpperCase()} SSE frames without buffering`, async () => {
    const response = await rawRequest(
      `/api/langgraph/probe/sse?ending=${ending}`,
    );
    expect(response.status).toBe(200);
    expect(response.headers["content-location"]).toBe(
      "/api/threads/redacted/runs/redacted",
    );
    expect(response.headers.location).toBe(
      "/api/threads/redacted/runs/redacted/stream",
    );
    expect(response.body).toContain("event: values");
    expect(response.body).toContain(ending === "crlf" ? "\r\n\r\n" : "\n\n");
    expect(response.firstChunkMs).toBeLessThan(150);
    expect(response.endMs).toBeGreaterThanOrEqual(150);
  });
}

test("@proxy streamRequest forwards request chunks before the body completes", async () => {
  const result = await new Promise<string>((resolve, reject) => {
    const request = httpRequest(
      "http://127.0.0.1:3101/api/langgraph/probe/request-stream",
      {
        method: "POST",
        headers: {
          "content-length": "8",
          "content-type": "application/octet-stream",
        },
      },
      (response) => {
        response.setEncoding("utf8");
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => resolve(body));
      },
    );
    request.on("error", reject);
    request.write("1234");
    setTimeout(() => request.end("5678"), 180);
  });
  const frames = result
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { phase: string; bytes: number });
  expect(frames[0]).toEqual({ phase: "first-chunk", chunks: 1, bytes: 4 });
  expect(frames.at(-1)?.phase).toBe("end");
  expect(frames.at(-1)?.bytes).toBe(8);
});

test("@proxy enforces the production 20 MiB request limit", async () => {
  const response = await rawRequest("/api/langgraph/probe/request-stream", {
    method: "POST",
    headers: { "content-length": String(20 * 1024 * 1024 + 1) },
    body: Buffer.alloc(20 * 1024 * 1024 + 1, "x"),
  });
  expect(response.status).toBe(413);
});

test("@proxy rejects encoded traversal before wildcard rewrite", async () => {
  const response = await rawRequest("/api/langgraph/%252e%252e/features");
  expect(response.status).toBe(400);
});
