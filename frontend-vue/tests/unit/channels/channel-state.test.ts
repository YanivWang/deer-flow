/*
  【文件职责】     固定 provider capability 与用户 connection instance 分离后的展示模型。
  【架构位置】     纯逻辑测试
  【主要导出】     无；Vitest cases
  【依赖关系】     core/channels/state · query-keys
  【边界与注意】   有 connection row 时 row 是真相；一行都没有时回落到 provider.connection_status。
                   后者带着 connections 表达不了的事实（auth 关闭部署下配好即已连接、没有 row），
                   见 core/channels/state.ts 的头注释。
*/

import { describe, expect, it } from "vitest";

import { channelKeys } from "@/core/channels/query-keys";
import {
  buildChannelProviderViews,
  getChannelConnectionLabel,
  getChannelProviderStatusKey,
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
  it("falls back to the provider status when the user owns no connection row", () => {
    const [view] = buildChannelProviderViews(
      [provider({ connection_status: "connected" })],
      [],
    );

    expect(view).toMatchObject({ status: "connected", connections: [] });
    expect(getChannelProviderStatusKey(view!)).toBe("connected");
  });

  it("lets a connected instance win over a not-connected provider status", () => {
    const [view] = buildChannelProviderViews(
      [provider({ connection_status: "not_connected" })],
      [connection("connection-a", "connected")],
    );

    expect(view).toMatchObject({ status: "connected" });
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

  it("lets any present row outrank the provider status", () => {
    const connectedProvider = provider({ connection_status: "connected" });
    expect(
      buildChannelProviderViews(
        [connectedProvider],
        [connection("pending", "pending")],
      )[0]?.status,
    ).toBe("pending");
    expect(
      buildChannelProviderViews(
        [connectedProvider],
        [connection("revoked", "revoked")],
      )[0]?.status,
    ).toBe("revoked");
    expect(buildChannelProviderViews([provider()], [])[0]?.status).toBe(
      "not_connected",
    );
  });
});

describe("channel provider status precedence", () => {
  /*
    停用 / 未配置 / 运行时不可用都排在连接状态之前，与 React 设置页的 getStatusLabel
    同序。负向验证：把 getChannelProviderStatusKey 里的任意一条前置判据删掉，
    对应的那个断言立刻红——它们的 status 都已经是 "connected"。
  */
  function keyOf(
    overrides: Partial<ChannelProvider>,
    rows: ChannelConnection[] = [],
  ) {
    const [view] = buildChannelProviderViews([provider(overrides)], rows);
    return getChannelProviderStatusKey(view!);
  }

  it("puts an unavailable runtime ahead of a connected binding", () => {
    expect(
      keyOf(
        {
          connection_status: "connected",
          unavailable_reason: "Slack runtime is not running.",
        },
        [connection("connection-a", "connected")],
      ),
    ).toBe("unavailable");
  });

  it("puts an unconfigured provider ahead of a connected binding", () => {
    expect(
      keyOf({ configured: false, connection_status: "connected" }, [
        connection("connection-a", "connected"),
      ]),
    ).toBe("unconfigured");
  });

  it("keeps the derived status when the runtime is healthy", () => {
    expect(keyOf({ connection_status: "connected" })).toBe("connected");
    expect(keyOf({ connection_status: "not_connected" })).toBe("not_connected");
    expect(keyOf({}, [connection("connection-a", "pending")])).toBe("pending");
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
