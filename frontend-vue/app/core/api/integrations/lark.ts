import { appendCsrfHeader } from "../csrf";

export class LarkIntegrationRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "LarkIntegrationRequestError";
    this.status = status;
  }

  get isAdminRequired(): boolean {
    return this.status === 403;
  }
}

export type LarkAuthProbe = {
  status: string;
  message: string | null;
  user: string | null;
  verified: boolean;
};

export type LarkCliProbe = {
  available: boolean;
  path: string | null;
  version: string | null;
  error: string | null;
};

export type LarkIntegrationStatus = {
  installed: boolean;
  version: string;
  manifest_version: string | null;
  latest_available_version: string | null;
  runtime_version_mismatch: boolean;
  app_configured: boolean;
  app_id: string | null;
  app_brand: string | null;
  skills_expected: number;
  skills_installed: number;
  installed_skills: string[];
  enabled_skills: string[];
  install_path: string;
  cli: LarkCliProbe;
  auth: LarkAuthProbe;
  sandbox_runtime_mode: string;
  sandbox_runtime_ready: boolean;
  sandbox_runtime_detail: string | null;
};

export type LarkInstallResponse = {
  success: boolean;
  installed_skills: string[];
  message: string;
  status: LarkIntegrationStatus;
};

export type LarkAuthStartRequest = {
  recommend?: boolean;
  domains?: string[];
  scope?: string | null;
};

export type LarkAuthStartResponse = {
  verification_url: string;
  device_code: string;
  expires_in: number | null;
  user_code: string | null;
  hint: string | null;
};

export type LarkConfigStartRequest = {
  brand?: string;
};

export type LarkConfigStartResponse = {
  verification_url: string;
  device_code: string;
  expires_in: number | null;
  interval: number | null;
  user_code: string | null;
  brand: string;
};

export type LarkConfigCompleteRequest = {
  device_code: string;
  brand?: string;
  interval?: number | null;
  expires_in?: number | null;
};

export type LarkAuthCompleteRequest = {
  device_code: string;
  wait_timeout_seconds?: number;
};

export type LarkCompleteResponse = {
  success: boolean;
  message: string;
  status: LarkIntegrationStatus;
};

export async function loadLarkIntegrationStatus(): Promise<LarkIntegrationStatus> {
  return fetchLarkJson<LarkIntegrationStatus>("/api/integrations/lark/status");
}

export async function installLarkIntegration(): Promise<LarkInstallResponse> {
  return fetchLarkJson<LarkInstallResponse>("/api/integrations/lark/install", {
    method: "POST",
  });
}

export async function startLarkAuthorization(
  request: LarkAuthStartRequest = {},
): Promise<LarkAuthStartResponse> {
  return fetchLarkJson<LarkAuthStartResponse>("/api/integrations/lark/auth/start", {
    body: JSON.stringify(request),
    method: "POST",
  });
}

export async function completeLarkAuthorization(
  request: LarkAuthCompleteRequest,
): Promise<LarkCompleteResponse> {
  return fetchLarkJson<LarkCompleteResponse>("/api/integrations/lark/auth/complete", {
    body: JSON.stringify(request),
    method: "POST",
  });
}

export async function startLarkConfiguration(
  request: LarkConfigStartRequest = {},
): Promise<LarkConfigStartResponse> {
  return fetchLarkJson<LarkConfigStartResponse>("/api/integrations/lark/config/start", {
    body: JSON.stringify(request),
    method: "POST",
  });
}

export async function completeLarkConfiguration(
  request: LarkConfigCompleteRequest,
): Promise<LarkCompleteResponse> {
  return fetchLarkJson<LarkCompleteResponse>("/api/integrations/lark/config/complete", {
    body: JSON.stringify(request),
    method: "POST",
  });
}

async function fetchLarkJson<T>(
  path: string,
  init: Omit<RequestInit, "headers"> & { headers?: HeadersInit } = {},
): Promise<T> {
  const method = init.method ?? "GET";
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: buildHeaders(init.headers, method),
    method,
  });

  if (!response.ok) {
    throw new LarkIntegrationRequestError(
      response.status,
      await readResponseErrorMessage(response),
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

async function readResponseErrorMessage(response: Response): Promise<string> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return `HTTP ${response.status}: ${response.statusText}`;
  }
  const detail = isRecord(payload) ? payload.detail : undefined;
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }
  return `HTTP ${response.status}: ${response.statusText}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
