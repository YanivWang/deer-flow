/*
  【文件职责】     把 provider capability 与用户 connection instances 合成为展示模型。
  【架构位置】     L3 pure channel state
  【主要导出】     ChannelProviderView · buildChannelProviderViews · getChannelConnectionLabel
  【依赖关系】     ./types
  【边界与注意】   status 只从 connections 推导；严禁回退到 provider.connection_status。
*/

import type { ChannelConnection, ChannelProvider } from "./types";

export interface ChannelProviderView {
  provider: ChannelProvider;
  connections: ChannelConnection[];
  status: string;
  isConnected: boolean;
}

const STATUS_PRIORITY = ["connected", "pending", "revoked"] as const;

export function getChannelConnectionLabel(
  connection: ChannelConnection,
): string {
  const identity = connection.external_account_name?.trim();
  const workspace = connection.workspace_name?.trim();
  return [identity, workspace].filter(Boolean).join(" · ") || connection.id;
}

export function buildChannelProviderViews(
  providers: ChannelProvider[],
  connections: ChannelConnection[],
): ChannelProviderView[] {
  return providers
    .filter((provider) => provider.enabled)
    .map((provider) => {
      const instances = connections.filter(
        (connection) => connection.provider === provider.provider,
      );
      const status =
        STATUS_PRIORITY.find((candidate) =>
          instances.some((connection) => connection.status === candidate),
        ) ??
        instances[0]?.status ??
        "not_connected";
      return {
        provider,
        connections: instances,
        status,
        isConnected: status === "connected",
      };
    });
}
