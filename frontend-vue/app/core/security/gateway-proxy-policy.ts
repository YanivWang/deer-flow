export interface ProxyPolicy {
  readonly allowedPaths: readonly string[];
  readonly strippedRequestHeaders: ReadonlySet<string>;
  readonly strippedResponseHeaders: ReadonlySet<string>;
  readonly credential: { readonly type: "cookie"; readonly name: string };
  readonly timeoutMs: number;
  readonly csrf: boolean;
}

export const LANGGRAPH_COMPAT_POLICY: ProxyPolicy = {
  allowedPaths: ["threads", "runs", "assistants", "store", "models", "mcp", "skills", "memory"],
  strippedRequestHeaders: new Set([
    "host",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "te",
    "trailer",
    "upgrade",
    "authorization",
    "x-api-key",
    "origin",
    "referer",
    "proxy-authorization",
    "proxy-authenticate",
  ]),
  strippedResponseHeaders: new Set([
    "connection",
    "keep-alive",
    "transfer-encoding",
    "te",
    "trailer",
    "upgrade",
    "content-length",
    "set-cookie",
  ]),
  credential: { type: "cookie", name: "access_token" },
  timeoutMs: 120_000,
  csrf: true,
};

export function isAllowedLangGraphPath(path: string, policy = LANGGRAPH_COMPAT_POLICY): boolean {
  const firstSegment = path.replace(/^\/+/, "").split("/")[0] ?? "";
  return policy.allowedPaths.includes(firstSegment);
}

export function buildForwardHeaders(
  source: HeadersInit,
  accessToken: string | undefined,
  policy = LANGGRAPH_COMPAT_POLICY,
): Headers {
  const result = new Headers(source);
  for (const header of policy.strippedRequestHeaders) {
    result.delete(header);
  }
  if (accessToken) {
    result.set("cookie", `${policy.credential.name}=${encodeURIComponent(accessToken)}`);
  } else {
    result.delete("cookie");
  }
  return result;
}

export function shouldRequireCsrf(method: string, policy = LANGGRAPH_COMPAT_POLICY): boolean {
  return policy.csrf && method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

export function stripResponseHeaders(response: Headers, policy = LANGGRAPH_COMPAT_POLICY): Headers {
  const result = new Headers(response);
  for (const header of policy.strippedResponseHeaders) {
    result.delete(header);
  }
  return result;
}
