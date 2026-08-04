/*
  【文件职责】     对生产 Gateway proxy 统一执行路径、body 与流式策略。
  【对应 frontend/】 frontend/next.config.js 与 docker/nginx/nginx.local.conf
  【架构位置】     L3
  【主要导出】     assertSafeGatewayRequest、proxyGatewayRequest
  【依赖关系】     消费 h3 proxyRequest 与 config/routes.ts 安全常量
  【边界与注意】   routeRules 不提供 body limit；所有 API handler 必须经过本函数。
*/

import {
  createError,
  getHeader,
  getRequestURL,
  proxyRequest,
  type H3Event,
} from "h3";
import { MAX_PROXY_BODY_BYTES, hasUnsafeProxyPath } from "../../config/routes";

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function assertSafeGatewayRequest(event: H3Event) {
  const rawUrl = event.node.req.url ?? "";
  if (hasUnsafeProxyPath(rawUrl)) {
    throw createError({ statusCode: 400, statusMessage: "Unsafe proxy path" });
  }
  if (!METHODS_WITH_BODY.has(event.node.req.method ?? "")) return;

  const transferEncoding = getHeader(event, "transfer-encoding");
  const contentLength = getHeader(event, "content-length");
  if (
    transferEncoding?.toLowerCase().includes("chunked") ||
    contentLength === undefined
  ) {
    throw createError({
      statusCode: 411,
      statusMessage: "Content-Length required",
    });
  }
  const bodyBytes = Number(contentLength);
  if (!Number.isSafeInteger(bodyBytes) || bodyBytes < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid Content-Length",
    });
  }
  if (bodyBytes > MAX_PROXY_BODY_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: "Request body exceeds 20 MiB",
    });
  }
}

export function proxyGatewayRequest(event: H3Event) {
  assertSafeGatewayRequest(event);
  const config = useRuntimeConfig(event);
  const requestUrl = getRequestURL(event);
  const pathname = requestUrl.pathname.startsWith("/api/langgraph/")
    ? requestUrl.pathname.replace(/^\/api\/langgraph(?=\/|$)/, "/api")
    : requestUrl.pathname;
  const target = `${config.gatewayInternalBaseUrl}${pathname}${requestUrl.search}`;
  const streamingEnabled = process.env.DEER_FLOW_PROXY_STREAMING !== "0";
  return proxyRequest(event, target, {
    fetchOptions: { redirect: "manual" },
    sendStream: streamingEnabled,
    streamRequest: streamingEnabled,
  });
}
