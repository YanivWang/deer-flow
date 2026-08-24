/*
  【文件职责】     固定 provider capability 与用户 connection instance 分离后的展示模型。
  【架构位置】     WP-08 纯逻辑测试
  【主要导出】     无；Vitest cases
  【依赖关系】     core/channels/state · query-keys
  【边界与注意】   connections 响应是用户连接状态真相；provider.connection_status 不能覆盖它。
*/

import { describe, expect, it } from "vitest";

import { channelKeys } from "@/core/channels/query-keys";
import {
  buildChannelProviderViews,
  getChannelConnectionLabel,
} from "@/core/channels/state";
import type { ChannelConnection, ChannelProvider } from "@/core/channels/types";

function provider(overrides: Partial<ChannelProvider> = {}): ChannelProvider {
  return {
    provider: "slack",
    display_name: "Slack",
    enabled: true,
    configured: true,
    connectable: true,
    auth_mode: "binding_code",
    connection_status: "not_connected",
    credential_fields: [],
    ...overrides,
  };
}

function connection(
  id: string,
  status: string,
  overrides: Partial<ChannelConnection> = {},
): ChannelConnection {
  return {
    id,
    provider: "slack",
    status,
    scopes: [],
    metadata: {},
    ...overrides,
  };
}

describe("channel provider views", () => {
  it("uses an empty connections response over a stale connected provider status", () => {
    const [view] = buildChannelProviderViews(
      [provider({ connection_status: "connected" })],
      [],
    );

    expect(view).toMatchObject({
      status: "not_connected",
      isConnected: false,
      connections: [],
    });
  });

  it("uses a connected instance over a stale not-connected provider status", () => {
    const [view] = buildChannelProviderViews(
      [provider({ connection_status: "not_connected" })],
      [connection("connection-a", "connected")],
    );

    expect(view).toMatchObject({ status: "connected", isConnected: true });
    expect(view?.connections.map(({ id }) => id)).toEqual(["connection-a"]);
  });

  it("keeps every same-provider account in response order with stable ids", () => {
    const rows = [
      connection("connection-b", "pending", {
        external_account_name: "Bob",
        workspace_name: "Workspace B",
      }),
      connection("connection-a", "connected", {
        external_account_name: "Alice",
        workspace_name: "Workspace A",
      }),
      connection("connection-old", "revoked"),
    ];
    const [view] = buildChannelProviderViews([provider()], rows);

    expect(view?.status).toBe("connected");
    expect(view?.connections.map(({ id }) => id)).toEqual([
      "connection-b",
      "connection-a",
      "connection-old",
    ]);
    expect(getChannelConnectionLabel(rows[1]!)).toBe("Alice · Workspace A");
    expect(getChannelConnectionLabel(rows[2]!)).toBe("connection-old");
  });

  it("derives pending, revoked and never-connected without provider fallback", () => {
    expect(
      buildChannelProviderViews(
        [provider()],
        [connection("pending", "pending")],
      )[0]?.status,
    ).toBe("pending");
    expect(
      buildChannelProviderViews(
        [provider()],
        [connection("revoked", "revoked")],
      )[0]?.status,
    ).toBe("revoked");
    expect(buildChannelProviderViews([provider()], [])[0]?.status).toBe(
      "not_connected",
    );
  });
});

describe("channel query keys", () => {
  it("isolates provider and connection truth by authenticated scope", () => {
    expect(channelKeys.providers("user-a")).toEqual([
      "channels",
      "user-a",
      "providers",
    ]);
    expect(channelKeys.connections("user-b")).toEqual([
      "channels",
      "user-b",
      "connections",
    ]);
    expect(channelKeys.scope("user-a")).not.toEqual(
      channelKeys.scope("user-b"),
    );
  });
});
