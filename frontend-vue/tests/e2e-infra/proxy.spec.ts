/*
  【文件职责】     验证 production preview 的 rewrite、流式响应、请求流和 headers。
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

test("@proxy forwards the client-facing origin and overwrites spoofed values", async ({
  request,
}) => {
  const expected = {
    forwarded: 'host="localhost:3101";proto=http',
    xForwardedHost: "localhost:3101",
    xForwardedProto: "http",
    xForwardedPort: "3101",
  };

  const clean = await request.get("/api/probe/forwarded");
  expect(clean.status()).toBe(200);
  expect(await clean.json()).toEqual(expected);

  // RFC 7239 `Forwarded` outranks `X-Forwarded-Host` in the Gateway's origin
  // lookup, so passing any of these through would let a browser steer the OIDC
  // redirect_uri. All four must be overwritten, not merged.
  const spoofed = await request.get("/api/probe/forwarded", {
    headers: {
      forwarded: 'host="evil.example";proto=https',
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
      "x-forwarded-port": "1337",
    },
  });
  expect(spoofed.status()).toBe(200);
  const body = await spoofed.json();
  expect(JSON.stringify(body)).not.toContain("evil.example");
  expect(body).toEqual(expected);
});

test("@proxy preserves request cookies, custom headers and separate Set-Cookie responses", async () => {
  const response = await rawRequest("/api/probe/cookies", {
    headers: {
      cookie: "access_token=session; csrf_token=csrf",
      "x-proxy-probe": "preserved",
    },
  });

  expect(response.status).toBe(200);
  expect(JSON.parse(response.body)).toEqual({
    cookie: "access_token=session; csrf_token=csrf",
    probeHeader: "preserved",
  });
  expect(response.headers["set-cookie"]).toEqual([
    "access_token=rotated; Path=/; HttpOnly; SameSite=Lax",
    "csrf_token=rotated-csrf; Path=/; SameSite=Strict",
  ]);
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

test("@proxy forwards every current bodyless DELETE call through the real Nitro route", async () => {
  const paths = [
    "/api/langgraph/threads/thread-1",
    "/api/channels/connections/connection-1",
    "/api/channels/slack/runtime-config",
    "/api/threads/thread-1/runs/run-1/feedback",
    "/api/memory",
    "/api/memory/facts/fact-1",
    "/api/scheduled-tasks/task-1",
    "/api/agents/agent-1",
    "/api/threads/thread-1/uploads/report.txt",
    "/api/threads/thread-1/goal",
  ];

  for (const path of paths) {
    const response = await rawRequest(path, { method: "DELETE" });
    expect(response.status, path).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      method: "DELETE",
      bytes: 0,
      body: "",
    });
  }
});

test("@proxy preserves declared DELETE and PATCH request bodies", async () => {
  const body = JSON.stringify({ reason: "parity-test" });
  for (const method of ["DELETE", "PATCH"]) {
    const response = await rawRequest("/api/probe/request-body", {
      method,
      headers: {
        "content-length": String(Buffer.byteLength(body)),
        "content-type": "application/json",
      },
      body,
    });

    expect(response.status, response.body).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      path: "/api/probe/request-body",
      method,
      bytes: Buffer.byteLength(body),
      body,
    });
  }
});

test("@proxy accepts a chunked request body and forwards its exact bytes", async () => {
  const response = await new Promise<RawResponse>((resolve, reject) => {
    const started = Date.now();
    const request = httpRequest(
      "http://127.0.0.1:3101/api/probe/request-body",
      {
        method: "DELETE",
        headers: {
          "content-type": "text/plain",
          "transfer-encoding": "chunked",
        },
      },
      (incoming) => {
        incoming.setEncoding("utf8");
        let body = "";
        let firstChunkMs = -1;
        incoming.on("data", (chunk) => {
          if (firstChunkMs < 0) firstChunkMs = Date.now() - started;
          body += chunk;
        });
        incoming.on("end", () =>
          resolve({
            status: incoming.statusCode ?? 0,
            body,
            headers: incoming.headers,
            firstChunkMs,
            endMs: Date.now() - started,
          }),
        );
      },
    );
    request.on("error", reject);
    request.write("chunk-one|");
    request.end("chunk-two");
  });

  expect(response.status, response.body).toBe(200);
  expect(JSON.parse(response.body)).toMatchObject({
    method: "DELETE",
    bytes: 19,
    body: "chunk-one|chunk-two",
  });
});

test("@proxy enforces the production 20 MiB request limit", async () => {
  const response = await rawRequest("/api/langgraph/probe/request-stream", {
    method: "DELETE",
    headers: { "content-length": String(20 * 1024 * 1024 + 1) },
    body: Buffer.alloc(20 * 1024 * 1024 + 1, "x"),
  });
  expect(response.status).toBe(413);
});

test("@proxy enforces the production limit while reading a chunked body", async () => {
  const response = await rawRequest("/api/probe/request-body", {
    method: "DELETE",
    headers: { "transfer-encoding": "chunked" },
    body: Buffer.alloc(20 * 1024 * 1024 + 1, "x"),
  });
  expect(response.status).toBe(413);
});

test("@proxy rejects encoded traversal before wildcard rewrite", async () => {
  const response = await rawRequest("/api/langgraph/%252e%252e/features");
  expect(response.status).toBe(400);
});
