/*
  【文件职责】     对生产 Gateway proxy 统一执行路径、body 与流式策略。
  【架构位置】     L3
  【主要导出】     assertSafeGatewayRequest、proxyGatewayRequest
  【依赖关系】     消费 h3 proxyRequest 与 config/routes.ts 安全常量
  【边界与注意】   routeRules 不提供 body limit；所有 API handler 必须经过本函数。
*/

import {
  createError,
  getHeader,
  getProxyRequestHeaders,
  getRequestWebStream,
  getRequestHost,
  getRequestProtocol,
  getRequestURL,
  sendProxy,
  type H3Event,
} from "h3";
import {
  MAX_PROXY_BODY_BYTES,
  buildForwardingHeaders,
  hasUnsafeProxyPath,
  isSafeForwardedHost,
} from "../../config/routes";

const METHODS_WITH_OPTIONAL_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type ProxyRequestBodyPlan =
  { kind: "none" } | { kind: "fixed"; bytes: number } | { kind: "chunked" };

function bodyLimitError() {
  return createError({
    statusCode: 413,
    statusMessage: "Request body exceeds 20 MiB",
  });
}

/**
 * Classify only a body the request actually declares.
 *
 * DELETE is allowed to be bodyless by HTTP semantics. A missing
 * Content-Length is therefore not an error; a positive length or chunked
 * transfer is the signal that there is a body to read and limit.
 */
export function inspectProxyRequestBody(
  method: string | undefined,
  contentLength: string | undefined,
  transferEncoding: string | undefined,
): ProxyRequestBodyPlan {
  if (!METHODS_WITH_OPTIONAL_BODY.has(method?.toUpperCase() ?? "")) {
    return { kind: "none" };
  }

  if (contentLength !== undefined) {
    if (!/^\d+$/.test(contentLength)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid Content-Length",
      });
    }
    const bytes = Number(contentLength);
    if (!Number.isSafeInteger(bytes)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid Content-Length",
      });
    }
    if (bytes > MAX_PROXY_BODY_BYTES) throw bodyLimitError();
    if (bytes > 0) return { kind: "fixed", bytes };
  }

  if (transferEncoding?.toLowerCase().includes("chunked")) {
    return { kind: "chunked" };
  }
  return { kind: "none" };
}

export function assertSafeGatewayRequest(event: H3Event): ProxyRequestBodyPlan {
  const rawUrl = event.node.req.url ?? "";
  if (hasUnsafeProxyPath(rawUrl)) {
    throw createError({ statusCode: 400, statusMessage: "Unsafe proxy path" });
  }
  if (!isSafeForwardedHost(getRequestHost(event))) {
    throw createError({ statusCode: 400, statusMessage: "Unsafe Host header" });
  }
  return inspectProxyRequestBody(
    event.node.req.method,
    getHeader(event, "content-length"),
    getHeader(event, "transfer-encoding"),
  );
}

/**
 * Buffer an unknown-length request with an actual byte cap. Once the cap is
 * crossed, detach the collector and drain subsequent bytes without retaining
 * them so the 20 MiB limit remains a memory limit as well as a status check.
 */
function readLimitedRequestBody(
  event: H3Event,
): Promise<Uint8Array<ArrayBuffer>> {
  const request = event.node.req;
  if (request.readableEnded) {
    return Promise.resolve(new Uint8Array(new ArrayBuffer(0)));
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;

    const cleanup = () => {
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
    };
    const onData = (chunk: Buffer | string) => {
      const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += value.length;
      if (bytes > MAX_PROXY_BODY_BYTES) {
        cleanup();
        request.resume();
        reject(bodyLimitError());
        return;
      }
      chunks.push(value);
    };
    const onEnd = () => {
      cleanup();
      const body = new Uint8Array(new ArrayBuffer(bytes));
      body.set(Buffer.concat(chunks, bytes));
      resolve(body);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    request.on("data", onData);
    request.on("end", onEnd);
    request.on("error", onError);
  });
}

export async function proxyGatewayRequest(event: H3Event) {
  const bodyPlan = assertSafeGatewayRequest(event);
  const config = useRuntimeConfig(event);
  const requestUrl = getRequestURL(event);
  const pathname = requestUrl.pathname.startsWith("/api/langgraph/")
    ? requestUrl.pathname.replace(/^\/api\/langgraph(?=\/|$)/, "/api")
    : requestUrl.pathname;
  const target = `${config.gatewayInternalBaseUrl}${pathname}${requestUrl.search}`;
  const streamingEnabled = process.env.DEER_FLOW_PROXY_STREAMING !== "0";

  // h3 drops `host` when the proxy target is an absolute URL, so without these
  // the Gateway only ever sees its own address and derives an OIDC redirect_uri
  // pointing at itself instead of this entry. Read without the x-forwarded
  // options on purpose: this proxy is the outermost hop in M0's dual dev mode,
  // so client-supplied forwarding headers are input, not trust. Putting a
  // trusted proxy in front of Nuxt (M7) means revisiting this to honour that
  // proxy's headers instead.
  const forwarding = buildForwardingHeaders(
    getRequestHost(event),
    getRequestProtocol(event, { xForwardedProto: false }),
  );

  const requestHeaders = new Headers(
    getProxyRequestHeaders(event, { host: false }),
  );
  for (const [name, value] of Object.entries(forwarding)) {
    requestHeaders.set(name, value);
  }

  const mustBuffer =
    bodyPlan.kind === "chunked" ||
    (bodyPlan.kind === "fixed" && !streamingEnabled);
  const body =
    bodyPlan.kind === "none"
      ? undefined
      : mustBuffer
        ? await readLimitedRequestBody(event)
        : getRequestWebStream(event);

  return sendProxy(event, target, {
    sendStream: streamingEnabled,
    fetchOptions: {
      method: event.method,
      headers: requestHeaders,
      redirect: "manual",
      ...(body === undefined ? {} : { body }),
      ...(body instanceof ReadableStream ? { duplex: "half" as const } : {}),
    },
  });
}
