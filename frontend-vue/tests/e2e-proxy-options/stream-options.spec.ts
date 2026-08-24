/*
  【文件职责】     证明关闭 sendStream/streamRequest 后响应与请求都发生整段缓冲。
  【架构位置】     测试
  【主要导出】     @proxy-options-disabled cases
  【依赖关系】     使用关闭流选项的 production Preview 与 proxy probe
  【边界与注意】   与 tests/m0/proxy.spec.ts 的默认开启态构成对照。
*/

import { request as httpRequest } from "node:http";
import { expect, test } from "@playwright/test";

test("@proxy-options-disabled buffers an SSE response until upstream ends", async () => {
  const started = Date.now();
  const firstChunkMs = await new Promise<number>((resolve, reject) => {
    const request = httpRequest(
      "http://127.0.0.1:3102/api/langgraph/probe/sse?ending=lf",
      (response) => response.once("data", () => resolve(Date.now() - started)),
    );
    request.on("error", reject);
    request.end();
  });
  expect(firstChunkMs).toBeGreaterThanOrEqual(150);
});

test("@proxy-options-disabled buffers the request before forwarding it", async () => {
  const result = await new Promise<string>((resolve, reject) => {
    const request = httpRequest(
      "http://127.0.0.1:3102/api/langgraph/probe/request-stream",
      { method: "POST", headers: { "content-length": "8" } },
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
  const first = JSON.parse(result.split("\n", 1)[0] ?? "{}") as {
    bytes?: number;
  };
  expect(first.bytes).toBe(8);
});
