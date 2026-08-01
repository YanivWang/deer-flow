import { appendCsrfHeader } from "../csrf";

export class McpConfigRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "McpConfigRequestError";
    this.status = status;
  }

  get isAdminRequired(): boolean {
    return this.status === 403;
  }
}

export type McpServerConfig = {
  enabled: boolean;
  description: string;
  type?: string;
  command?: string | null;
  args?: string[];
  url?: string | null;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  oauth?: McpOAuthConfig | null;
  routing?: McpRoutingConfig;
  tools?: Record<string, McpToolOverride>;
  tool_call_timeout?: number | null;
};

export type McpConfig = {
  mcp_servers: Record<string, McpServerConfig>;
};

export type McpOAuthConfig = {
  enabled: boolean;
  token_url: string;
  grant_type: "client_credentials" | "refresh_token";
  client_id?: string | null;
  client_secret?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  audience?: string | null;
  token_field: string;
  token_type_field: string;
  expires_in_field: string;
  default_token_type: string;
  refresh_skew_seconds: number;
  extra_token_params?: Record<string, string>;
};

export type McpRoutingConfig = {
  mode: "off" | "prefer";
  priority: number;
  keywords: string[];
};

export type McpToolOverride = {
  routing?: McpRoutingConfig;
};

export type McpCacheResetResponse = {
  success: boolean;
  message: string;
};

export async function loadMcpConfig(): Promise<McpConfig> {
  return fetchMcpJson<McpConfig>("/api/mcp/config");
}

export async function updateMcpConfig(config: McpConfig): Promise<McpConfig> {
  return fetchMcpJson<McpConfig>("/api/mcp/config", {
    body: JSON.stringify(config),
    method: "PUT",
  });
}

export async function updateMcpServerState(
  serverName: string,
  enabled: boolean,
): Promise<McpConfig> {
  return fetchMcpJson<McpConfig>("/api/mcp/config", {
    body: JSON.stringify({
      enabled,
      server_name: serverName,
    }),
    method: "PATCH",
  });
}

export async function resetMcpToolsCache(): Promise<McpCacheResetResponse> {
  return fetchMcpJson<McpCacheResetResponse>("/api/mcp/cache/reset", {
    method: "POST",
  });
}

async function fetchMcpJson<T>(
  path: string,
  init: Omit<RequestInit, "headers"> & { headers?: HeadersInit } = {},
): Promise<T> {
  const method = init.method ?? "GET";
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: buildHeaders(init.headers, method),
  });
  if (!response.ok) {
    throw new McpConfigRequestError(
      response.status,
      await readResponseErrorMessage(response, "加载 MCP 配置失败。"),
    );
  }
  return (await response.json()) as T;
}

function buildHeaders(headers: HeadersInit | undefined, method: string): Headers {
  const nextHeaders = new Headers(headers);
  if (method.toUpperCase() !== "GET" && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }
  return appendCsrfHeader(nextHeaders, method);
}

async function readResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return fallback;
  }
  const detail = isRecord(payload) ? payload.detail : undefined;
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }
  if (isRecord(detail) && typeof detail.message === "string" && detail.message.trim()) {
    return detail.message.trim();
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
