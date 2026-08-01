import { appendCsrfHeader } from "../csrf";

export class ChannelRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ChannelRequestError";
    this.status = status;
  }

  get isAdminRequired(): boolean {
    return this.status === 403;
  }
}

export type ChannelProviderId = "telegram" | "slack" | "discord" | string;

export type ChannelCredentialField = {
  name: string;
  label: string;
  type: string;
  required: boolean;
};

export type ChannelRuntimeConfigValues = Record<string, string>;

export type ChannelProvider = {
  provider: ChannelProviderId;
  display_name: string;
  enabled: boolean;
  configured: boolean;
  connectable: boolean;
  unavailable_reason: string | null;
  auth_mode: string;
  connection_status: string;
  credential_fields: ChannelCredentialField[];
  credential_values: ChannelRuntimeConfigValues;
};

export type ChannelProvidersResponse = {
  enabled: boolean;
  providers: ChannelProvider[];
};

export type ChannelConnection = {
  id: string;
  provider: ChannelProviderId;
  status: string;
  external_account_id: string | null;
  external_account_name: string | null;
  workspace_id: string | null;
  workspace_name: string | null;
  scopes: string[];
  metadata: Record<string, unknown>;
};

export type ChannelConnectionsResponse = {
  connections: ChannelConnection[];
};

export type ChannelConnectResponse = {
  provider: ChannelProviderId;
  mode: string;
  url: string | null;
  code: string;
  instruction: string;
  expires_in: number;
};

export async function loadChannelProviders(): Promise<ChannelProvidersResponse> {
  return fetchChannelsJson<ChannelProvidersResponse>("/api/channels/providers");
}

export async function loadChannelConnections(): Promise<ChannelConnection[]> {
  const response = await fetchChannelsJson<ChannelConnectionsResponse>(
    "/api/channels/connections",
  );
  return response.connections;
}

export async function connectChannelProvider(
  provider: ChannelProviderId,
): Promise<ChannelConnectResponse> {
  return fetchChannelsJson<ChannelConnectResponse>(
    `/api/channels/${encodeURIComponent(provider)}/connect`,
    { method: "POST" },
  );
}

export async function configureChannelProvider(
  provider: ChannelProviderId,
  values: ChannelRuntimeConfigValues,
): Promise<ChannelProvider> {
  return fetchChannelsJson<ChannelProvider>(
    `/api/channels/${encodeURIComponent(provider)}/runtime-config`,
    {
      body: JSON.stringify({ values }),
      method: "POST",
    },
  );
}

export async function disconnectChannelProvider(
  provider: ChannelProviderId,
): Promise<ChannelProvider> {
  return fetchChannelsJson<ChannelProvider>(
    `/api/channels/${encodeURIComponent(provider)}/runtime-config`,
    { method: "DELETE" },
  );
}

export async function disconnectChannelConnection(connectionId: string): Promise<void> {
  await fetchChannelsJson<unknown>(
    `/api/channels/connections/${encodeURIComponent(connectionId)}`,
    { method: "DELETE" },
  );
}

async function fetchChannelsJson<T>(
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
    throw new ChannelRequestError(
      response.status,
      await readResponseErrorMessage(response, `HTTP ${response.status}: ${response.statusText}`),
    );
  }
  if (response.status === 204) {
    return undefined as T;
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
