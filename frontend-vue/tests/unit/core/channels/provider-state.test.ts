/*
  【文件职责】     固定 provider capability/runtime-config 纯函数合同。
  【架构位置】     L1 core unit test
  【主要导出】     Vitest cases
  【依赖关系】     core/channels/provider-state
  【边界与注意】   适配：connection_status 不是 connect capability，也不能阻止多账号新增。
*/

import { describe, expect, it } from "vitest";

import {
  providerCanEditRuntimeConfig,
  providerNeedsRuntimeConfig,
  providerSupportsConnect,
} from "@/core/channels/provider-state";
import type { ChannelProvider } from "@/core/channels/types";

function makeProvider(overrides: Partial<ChannelProvider>): ChannelProvider {
  return {
    provider: "slack",
    display_name: "Slack",
    enabled: true,
    configured: true,
    connectable: true,
    auth_mode: "binding_code",
    connection_status: "not_connected",
    credential_fields: [
      {
        name: "bot_token",
        label: "Bot token",
        type: "password",
        required: true,
      },
    ],
    ...overrides,
  };
}

describe("providerSupportsConnect", () => {
  it("allows connecting a configured provider", () => {
    expect(providerSupportsConnect(makeProvider({}))).toBe(true);
  });

  it("does not treat a connected summary as a capability veto", () => {
    expect(
      providerSupportsConnect(makeProvider({ connection_status: "connected" })),
    ).toBe(true);
  });

  it("rejects a non-connectable provider", () => {
    expect(providerSupportsConnect(makeProvider({ connectable: false }))).toBe(
      false,
    );
  });

  it("falls back to enabled+configured when connectable is missing", () => {
    expect(
      providerSupportsConnect(makeProvider({ connectable: undefined })),
    ).toBe(true);
    expect(
      providerSupportsConnect(
        makeProvider({ connectable: undefined, configured: false }),
      ),
    ).toBe(false);
  });
});

describe("providerNeedsRuntimeConfig", () => {
  it("requires setup only when enabled and unconfigured with fields", () => {
    expect(
      providerNeedsRuntimeConfig(makeProvider({ configured: false })),
    ).toBe(true);
    expect(providerNeedsRuntimeConfig(makeProvider({}))).toBe(false);
    expect(
      providerNeedsRuntimeConfig(
        makeProvider({ configured: false, enabled: false }),
      ),
    ).toBe(false);
    expect(
      providerNeedsRuntimeConfig(
        makeProvider({ configured: false, credential_fields: [] }),
      ),
    ).toBe(false);
  });
});

describe("providerCanEditRuntimeConfig", () => {
  it("is editable whenever enabled with credential fields", () => {
    expect(providerCanEditRuntimeConfig(makeProvider({}))).toBe(true);
    expect(providerCanEditRuntimeConfig(makeProvider({ enabled: false }))).toBe(
      false,
    );
    expect(
      providerCanEditRuntimeConfig(makeProvider({ credential_fields: [] })),
    ).toBe(false);
  });
});
