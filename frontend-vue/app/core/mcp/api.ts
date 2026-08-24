/*
  【文件职责】     读取或写入 Gateway MCP config，并保留 admin-required HTTP 错误。
  【架构位置】     L3 Gateway adapter
  【主要导出】     MCPConfigRequestError · load/update MCP config
  【依赖关系】     authenticated fetch · Gateway error parser
  【边界与注意】   AbortSignal 由唯一 Vue Query owner 提供；不吞 403 或原始 detail。
*/

import { fetch } from "@/core/api/fetcher";
import { readGatewayResponseError } from "@/core/api/errors";
import { getBackendBaseURL } from "@/core/config";

import type { MCPConfig } from "./types";

export class MCPConfigRequestError extends Error {
  readonly status: number;
  constructor(
    status: number,
    message: string,
    readonly body: unknown = null,
    readonly responseText = "",
  ) {
    super(message);
    this.name = "MCPConfigRequestError";
    this.status = status;
  }
  get isAdminRequired(): boolean {
    return this.status === 403;
  }
}

async function readErrorDetail(
  response: Response,
  fallback: string,
): Promise<never> {
  const error = await readGatewayResponseError(response, fallback);
  throw new MCPConfigRequestError(
    response.status,
    error.message,
    error.body,
    error.responseText,
  );
}

export async function loadMCPConfig(options: { signal?: AbortSignal } = {}) {
  const response = await fetch(`${getBackendBaseURL()}/api/mcp/config`, {
    signal: options.signal,
  });
  if (!response.ok) {
    await readErrorDetail(response, "Failed to load MCP configuration");
  }
  return response.json() as Promise<MCPConfig>;
}

export async function updateMCPConfig(
  config: MCPConfig,
  options: { signal?: AbortSignal } = {},
) {
  const response = await fetch(`${getBackendBaseURL()}/api/mcp/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
    signal: options.signal,
  });
  if (!response.ok) {
    await readErrorDetail(response, "Failed to update MCP configuration");
  }
  return response.json();
}

export async function updateMCPServerState(
  serverName: string,
  enabled: boolean,
  options: { signal?: AbortSignal } = {},
) {
  const response = await fetch(`${getBackendBaseURL()}/api/mcp/config`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      server_name: serverName,
      enabled,
    }),
    signal: options.signal,
  });
  if (!response.ok) {
    await readErrorDetail(response, "Failed to update MCP server");
  }
  return response.json() as Promise<MCPConfig>;
}
