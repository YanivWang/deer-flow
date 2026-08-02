import {
  defineEventHandler,
  getCookie,
  getProxyRequestHeaders,
  getRequestURL,
  getRouterParam,
  proxyRequest,
  removeResponseHeader,
  setResponseHeader,
  setResponseStatus,
} from "h3";

import {
  buildForwardHeaders,
  isAllowedLangGraphPath,
  LANGGRAPH_COMPAT_POLICY,
} from "../../../../app/core/auth/proxy-policy";

export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, "path") ?? "";
  if (!isAllowedLangGraphPath(path)) {
    setResponseStatus(event, 404);
    return { detail: "LangGraph proxy path is not allowed" };
  }

  const runtimeConfig = useRuntimeConfig(event);
  const gatewayUrl = String(runtimeConfig.gatewayUrl).replace(/\/$/, "");
  const requestUrl = getRequestURL(event);
  const target = `${gatewayUrl}/api/${path}${requestUrl.search}`;
  const incomingHeaders = getProxyRequestHeaders(event, { host: false }) as HeadersInit;
  const headers = buildForwardHeaders(
    incomingHeaders,
    getCookie(event, LANGGRAPH_COMPAT_POLICY.credential.name),
  );
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), LANGGRAPH_COMPAT_POLICY.timeoutMs);

  try {
    return await proxyRequest(event, target, {
      headers,
      sendStream: true,
      streamRequest: true,
      fetchOptions: {
        signal: abortController.signal,
      },
      onResponse(responseEvent) {
        for (const header of LANGGRAPH_COMPAT_POLICY.strippedResponseHeaders) {
          removeResponseHeader(responseEvent, header);
        }
        setResponseHeader(responseEvent, "x-deerflow-proxy-policy", "langgraph-compat");
      },
    });
  } finally {
    clearTimeout(timeout);
  }
});
