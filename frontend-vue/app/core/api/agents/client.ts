import { appendCsrfHeader } from "../csrf";
import type { Agent, AgentNameCheckResult, CreateAgentRequest, UpdateAgentRequest } from "./types";

export type AgentsClientOptions = {
  endpointBase?: string;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export class AgentsApiDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentsApiDisabledError";
  }
}

export class AgentNameCheckError extends Error {
  constructor(
    message: string,
    public readonly reason: "backend_unreachable" | "request_failed",
    public readonly detail: string | null = null,
  ) {
    super(message);
    this.name = "AgentNameCheckError";
  }
}

const BACKEND_UNAVAILABLE_STATUSES = new Set([502, 503, 504]);
const JSON_HEADERS = {
  "Content-Type": "application/json",
};

export async function listAgents(options: AgentsClientOptions = {}): Promise<Agent[]> {
  const response = await fetchAgentsJson<{ agents: Agent[] }>("/api/agents", {
    method: "GET",
    ...options,
  });
  return response.agents;
}

export async function getAgent(
  name: string,
  options: AgentsClientOptions = {},
): Promise<Agent> {
  return fetchAgentsJson<Agent>(`/api/agents/${encodeURIComponent(name)}`, {
    method: "GET",
    ...options,
  });
}

export async function createAgent(
  request: CreateAgentRequest,
  options: AgentsClientOptions = {},
): Promise<Agent> {
  return fetchAgentsJson<Agent>("/api/agents", {
    body: JSON.stringify(request),
    method: "POST",
    ...options,
  });
}

export async function updateAgent(
  name: string,
  request: UpdateAgentRequest,
  options: AgentsClientOptions = {},
): Promise<Agent> {
  return fetchAgentsJson<Agent>(`/api/agents/${encodeURIComponent(name)}`, {
    body: JSON.stringify(request),
    method: "PUT",
    ...options,
  });
}

export async function deleteAgent(
  name: string,
  options: AgentsClientOptions = {},
): Promise<void> {
  await fetchAgentsJson<unknown>(`/api/agents/${encodeURIComponent(name)}`, {
    method: "DELETE",
    ...options,
  });
}

export async function checkAgentName(
  name: string,
  options: AgentsClientOptions = {},
): Promise<AgentNameCheckResult> {
  let response: Response;
  try {
    response = await fetch(
      buildUrl(options.endpointBase ?? "", `/api/agents/check?name=${encodeURIComponent(name)}`),
      {
        credentials: "include",
        headers: buildHeaders(options.headers, "GET"),
        method: "GET",
        signal: options.signal,
      },
    );
  } catch {
    throw new AgentNameCheckError(
      "无法连接 DeerFlow 后端。",
      "backend_unreachable",
    );
  }

  if (!response.ok) {
    const detail = await readResponseErrorMessage(response, null);
    if (isAgentsApiDisabledDetail(detail)) {
      throw new AgentsApiDisabledError(detail);
    }
    if (BACKEND_UNAVAILABLE_STATUSES.has(response.status)) {
      throw new AgentNameCheckError(
        "无法连接 DeerFlow 后端。",
        "backend_unreachable",
      );
    }
    throw new AgentNameCheckError(
      detail ?? `检查智能体名称失败：${response.statusText}`,
      "request_failed",
      detail,
    );
  }

  return (await response.json()) as AgentNameCheckResult;
}

async function fetchAgentsJson<T>(
  path: string,
  {
    endpointBase = "",
    headers,
    signal,
    ...init
  }: AgentsClientOptions & Omit<RequestInit, "headers" | "signal">,
): Promise<T> {
  const response = await fetch(buildUrl(endpointBase, path), {
    credentials: "include",
    headers: buildHeaders(headers, init.method),
    signal,
    ...init,
  });

  if (!response.ok) {
    const detail = await readResponseErrorMessage(response, "智能体请求失败。");
    if (isAgentsApiDisabledDetail(detail)) {
      throw new AgentsApiDisabledError(detail);
    }
    throw new Error(detail ?? "智能体请求失败。");
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function buildUrl(endpointBase: string, path: string): string {
  const prefix = endpointBase.replace(/\/$/, "");
  return `${prefix}${path}`;
}

function buildHeaders(headers: HeadersInit | undefined, method = "GET"): Headers {
  const nextHeaders = new Headers(headers);
  for (const [key, value] of Object.entries(JSON_HEADERS)) {
    if (!nextHeaders.has(key)) {
      nextHeaders.set(key, value);
    }
  }
  return appendCsrfHeader(nextHeaders, method);
}

async function readResponseErrorMessage(
  response: Response,
  fallback: string | null,
): Promise<string | null> {
  const text = await response.text();
  if (!text) {
    return fallback;
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fallback;
  }

  if (!isRecord(body)) {
    return fallback;
  }

  return formatResponseErrorDetail(body.detail) ?? fallback;
}

function formatResponseErrorDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") {
    const trimmed = detail.trim();
    return trimmed || undefined;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => formatResponseErrorDetail(item))
      .filter((item): item is string => Boolean(item));
    return messages.length > 0 ? messages.join("\n") : undefined;
  }

  if (isRecord(detail)) {
    for (const key of ["message", "msg", "error"]) {
      const value = detail[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return undefined;
}

function isAgentsApiDisabledDetail(detail: string | null): detail is string {
  return typeof detail === "string" && detail.includes("agents_api.enabled");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
