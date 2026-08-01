export const ALLOWED_LANGGRAPH_PREFIXES = [
  "threads",
  "runs",
  "assistants",
  "store",
  "models",
  "mcp",
  "skills",
  "memory",
] as const;

export const STRIPPED_REQUEST_HEADERS = [
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
] as const;

export const STRIPPED_RESPONSE_HEADERS = [
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "content-length",
  "set-cookie",
] as const;

export function isAllowedLangGraphPath(path: string): boolean {
  const normalized = path.replace(/^\/+/, "");
  return ALLOWED_LANGGRAPH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export function rewriteLangGraphPath(path: string): string | undefined {
  const normalized = path.replace(/^\/api\/langgraph\/?/, "").replace(/^\/+/, "");
  if (!isAllowedLangGraphPath(normalized)) {
    return undefined;
  }
  return `/api/${normalized}`;
}

export function filterRequestHeaders(headers: Headers): Headers {
  const next = new Headers(headers);
  for (const header of STRIPPED_REQUEST_HEADERS) {
    next.delete(header);
  }
  return next;
}

export function filterResponseHeaders(headers: Headers): Headers {
  const next = new Headers(headers);
  for (const header of STRIPPED_RESPONSE_HEADERS) {
    next.delete(header);
  }
  return next;
}
