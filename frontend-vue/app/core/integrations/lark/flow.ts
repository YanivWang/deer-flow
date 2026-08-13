/*
  【文件职责】     封装当前 Gateway 的 Lark 配置、授权和凭证切换 HTTP 契约。
  【对应 frontend/】 src/core/integrations/lark/api.ts
  【架构位置】     L3
  【主要导出】     Lark flow request types 与 status/config/auth API
  【依赖关系】     core/api/fetcher · core/config · frozen Lark status types
  【边界与注意】   当前流程独立于 frozen baseline API；generation 必须随 complete 请求回传，
                   以便 Gateway 拒绝过期流程。
*/
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";
import { installLarkIntegration, LarkIntegrationRequestError } from "./api";
import type { LarkIntegrationStatus } from "./types";

export { installLarkIntegration, LarkIntegrationRequestError };
export type LarkBrand = "feishu" | "lark";
export type LarkAuthStartRequest = {
  recommend?: boolean;
  domains?: string[];
  scope?: string | null;
  generation?: string;
};
export type LarkAuthStartResponse = {
  verification_url: string;
  device_code: string;
  generation: string;
  expires_in: number | null;
  user_code: string | null;
  hint: string | null;
};
export type LarkConfigStartResponse = {
  verification_url: string;
  device_code: string;
  generation: string;
  expires_in: number | null;
  interval: number | null;
  user_code: string | null;
  brand: LarkBrand;
};
export type LarkFlowResponse = {
  success: boolean;
  message: string;
  generation: string;
  status: LarkIntegrationStatus;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getBackendBaseURL()}${path}`, init);
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      detail?: string;
    };
    throw new LarkIntegrationRequestError(
      response.status,
      data.detail ?? `HTTP ${response.status}: ${response.statusText}`,
    );
  }
  return response.json() as Promise<T>;
}

export function loadLarkIntegrationStatus(signal?: AbortSignal) {
  return request<LarkIntegrationStatus>("/api/integrations/lark/status", {
    signal,
  });
}

export function startLarkConfiguration(brand: LarkBrand) {
  return request<LarkConfigStartResponse>(
    "/api/integrations/lark/config/start",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand }),
    },
  );
}

export function completeLarkConfiguration(requestBody: {
  device_code: string;
  generation: string;
  brand: LarkBrand;
  interval: number | null;
  expires_in: number | null;
}) {
  return request<LarkFlowResponse>("/api/integrations/lark/config/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
}

export function setLarkAppCredentials(requestBody: {
  app_id: string;
  app_secret: string;
  brand: LarkBrand;
}) {
  return request<LarkFlowResponse>(
    "/api/integrations/lark/config/credentials",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    },
  );
}

export function startLarkAuthorization(requestBody: LarkAuthStartRequest) {
  return request<LarkAuthStartResponse>("/api/integrations/lark/auth/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
}

export function completeLarkAuthorization(requestBody: {
  device_code: string;
  generation: string;
  wait_timeout_seconds?: number;
}) {
  return request<LarkFlowResponse>("/api/integrations/lark/auth/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
}
