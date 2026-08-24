/*
  【文件职责】     提供可观测的 HTTP/SSE 请求流探针，不冒充真实 Gateway。
  【架构位置】     测试夹具
  【主要导出】     本地 8012 HTTP server
  【依赖关系】     被 playwright.m0.config.ts 启动
  【边界与注意】   仅证明 Nitro 代理行为；真实 Gateway 由 real-backend config 另验。
*/

import { createServer } from "node:http";

const port = Number(process.env.PROXY_PROBE_PORT ?? 8012);

const server = createServer((request, response) => {
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "localhost"}`,
  );
  if (url.pathname === "/health") {
    response.setHeader("content-type", "application/json");
    response.end('{"status":"ok"}');
    return;
  }
  if (url.pathname === "/api/features") {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ source: "proxy-probe", path: url.pathname }));
    return;
  }
  if (url.pathname === "/api/probe/forwarded") {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        forwarded: request.headers.forwarded ?? null,
        xForwardedHost: request.headers["x-forwarded-host"] ?? null,
        xForwardedProto: request.headers["x-forwarded-proto"] ?? null,
        xForwardedPort: request.headers["x-forwarded-port"] ?? null,
      }),
    );
    return;
  }
  if (url.pathname === "/api/probe/cookies") {
    response.setHeader("content-type", "application/json");
    response.setHeader("set-cookie", [
      "access_token=rotated; Path=/; HttpOnly; SameSite=Lax",
      "csrf_token=rotated-csrf; Path=/; SameSite=Strict",
    ]);
    response.end(
      JSON.stringify({
        cookie: request.headers.cookie ?? null,
        probeHeader: request.headers["x-proxy-probe"] ?? null,
      }),
    );
    return;
  }
  if (url.pathname === "/api/probe/headers") {
    response.statusCode = 307;
    response.setHeader(
      "content-location",
      "/api/threads/redacted/runs/redacted",
    );
    response.setHeader("location", "/api/redirect-target");
    response.end();
    return;
  }
  if (
    url.pathname === "/api/probe/request-body" ||
    request.method === "DELETE"
  ) {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks);
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          path: url.pathname,
          method: request.method,
          bytes: body.length,
          body: body.toString("utf8"),
        }),
      );
    });
    return;
  }
  if (url.pathname === "/api/probe/sse") {
    const crlf = url.searchParams.get("ending") === "crlf";
    const end = crlf ? "\r\n" : "\n";
    response.writeHead(200, {
      "cache-control": "no-cache",
      "content-type": "text/event-stream",
      "content-location": "/api/threads/redacted/runs/redacted",
      location: "/api/threads/redacted/runs/redacted/stream",
      "x-accel-buffering": "no",
    });
    response.write(
      `id: 1${end}event: values${end}data: {"chunk":1}${end}${end}`,
    );
    setTimeout(() => {
      response.write(`: heartbeat${end}${end}`);
      response.end(`id: 2${end}event: end${end}data: null${end}${end}`);
    }, 180);
    return;
  }
  if (url.pathname === "/api/probe/request-stream") {
    let chunks = 0;
    let bytes = 0;
    request.on("data", (chunk) => {
      chunks += 1;
      bytes += chunk.length;
      if (chunks === 1 && !response.headersSent) {
        response.writeHead(200, { "content-type": "application/x-ndjson" });
        response.write(
          `${JSON.stringify({ phase: "first-chunk", chunks, bytes })}\n`,
        );
      }
    });
    request.on("end", () =>
      response.end(`${JSON.stringify({ phase: "end", chunks, bytes })}\n`),
    );
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ path: url.pathname }));
});

server.listen(port, "127.0.0.1", () =>
  console.log(`[proxy-probe] listening on ${port}`),
);

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
