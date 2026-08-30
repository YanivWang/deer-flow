/*
  【文件职责】     把 provider capability 与用户 connection instances 合成为展示模型。
  【架构位置】     L3 pure channel state
  【主要导出】     ChannelProviderView · buildChannelProviderViews · getChannelProviderStatusKey · getChannelConnectionLabel
  【依赖关系】     ./types
  【边界与注意】   有 connection row 时 row 是真相；一行都没有时才回落到 provider.connection_status。

                   两个字段不是「新鲜 vs 陈旧」的关系。Gateway 的 GET /providers 与
                   GET /connections 读的是**同一次请求里同一个 owner 的同一批行**
                   （backend/app/gateway/routers/channel_connections.py 的
                   get_channel_providers 先 list_connections(owner)，再把每个 provider
                   最新的那行喂给 _provider_response）。所以 connection_status 不可能
                   比 connections 更陈。

                   它反而多带一个 connections 结构上表达不了的事实：auth 关闭时
                   （DEER_FLOW_AUTH_DISABLED=1，本仓默认的本地跑法）每条渠道消息都路由到
                   默认用户，配好且跑起来的 provider **没有也不需要**任何 binding row，
                   后端直接回 connection_status="connected"。只认 connections 的话，
                   这种部署下侧栏永远显示「Connect」，点下去还会去走一遍毫无意义的绑定流程。

                   React 两处都是这个规则：设置页 getStatusLabel 写的就是
                   `connection?.status ?? provider.connection_status`
                   （frontend/src/components/workspace/settings/channels-settings-page.tsx），
                   侧栏直接读 provider.connection_status
                   （frontend/src/components/workspace/channels/workspace-channels-list.tsx）。
*/

import type { ChannelConnection, ChannelProvider } from "./types";

export interface ChannelProviderView {
  provider: ChannelProvider;
  connections: ChannelConnection[];
  /** 连接实例推导出的原始状态；渲染成文案前先过 getChannelProviderStatusKey。 */
  status: string;
}

const STATUS_PRIORITY = ["connected", "pending", "revoked"] as const;

/**
 * provider 一行要显示哪个状态词。
 *
 * 顺序照抄 React 设置页的 getStatusLabel
 * （frontend/src/components/workspace/settings/channels-settings-page.tsx）：
 * 停用、未配置、运行时不可用**排在连接状态之前**。少了这层，一个后端明说
 * unavailable_reason 的 provider 会因为还挂着一行 connected 而被写成「已连接」，
 * 而用户点下去只会拿到一句不可用。
 */
export function getChannelProviderStatusKey(view: ChannelProviderView): string {
  const { provider } = view;
  if (!provider.enabled) return "disabled";
  if (!provider.configured) return "unconfigured";
  if (provider.unavailable_reason) return "unavailable";
  return view.status;
}

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
        provider.connection_status ??
        "not_connected";
      return { provider, connections: instances, status };
    });
}
