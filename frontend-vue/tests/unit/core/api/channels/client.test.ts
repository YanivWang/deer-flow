import { describe, expect, it, vi } from "vitest";

import {
  configureChannelProvider,
  connectChannelProvider,
  disconnectChannelConnection,
  disconnectChannelProvider,
  loadChannelConnections,
  loadChannelProviders,
  type ChannelRequestError,
} from "../../../../../app/core/api/channels/client";

describe("channels API client", () => {
  it("loads channel providers and connections from Gateway routes", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const path = String(url);
      if (path === "/api/channels/providers") {
        return Response.json({
          enabled: true,
          providers: [channelProvider("telegram")],
        });
      }
      if (path === "/api/channels/connections") {
        return Response.json({
          connections: [channelConnection("connection-1", "telegram")],
        });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadChannelProviders()).resolves.toMatchObject({
      enabled: true,
      providers: [{ provider: "telegram" }],
    });
    await expect(loadChannelConnections()).resolves.toMatchObject([
      { id: "connection-1", provider: "telegram" },
    ]);

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "/api/channels/providers",
      "/api/channels/connections",
    ]);
  });

  it("connects, configures, and disconnects channels with CSRF headers", async () => {
    document.cookie = "csrf_token=channels-csrf";
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      if (path === "/api/channels/telegram/connect" && init?.method === "POST") {
        return Response.json({
          provider: "telegram",
          mode: "deep_link",
          url: "https://t.me/deer_bot?start=code",
          code: "code",
          instruction: "Send /start code to the DeerFlow Telegram bot.",
          expires_in: 600,
        });
      }
      if (path === "/api/channels/telegram/runtime-config" && init?.method === "POST") {
        return Response.json(channelProvider("telegram", { configured: true }));
      }
      if (path === "/api/channels/telegram/runtime-config" && init?.method === "DELETE") {
        return Response.json(channelProvider("telegram", { configured: false }));
      }
      if (path === "/api/channels/connections/connection-1" && init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await connectChannelProvider("telegram");
    await configureChannelProvider("telegram", {
      bot_token: "token",
      bot_username: "deer_bot",
    });
    await disconnectChannelProvider("telegram");
    await disconnectChannelConnection("connection-1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/channels/telegram/connect");
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("X-CSRF-Token")).toBe(
      "channels-csrf",
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          values: {
            bot_token: "token",
            bot_username: "deer_bot",
          },
        }),
        credentials: "include",
        method: "POST",
      }),
    );
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock.mock.calls[3]?.[1]).toEqual(
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("marks 403 responses as admin-required errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { detail: "Admin privileges required to manage channel runtime credentials." },
          { status: 403 },
        ),
      ),
    );

    await expect(disconnectChannelProvider("telegram")).rejects.toMatchObject({
      isAdminRequired: true,
      message: "Admin privileges required to manage channel runtime credentials.",
      status: 403,
    } satisfies Partial<ChannelRequestError>);
  });
});

function channelProvider(
  provider: string,
  overrides: Partial<ReturnType<typeof channelProviderBase>> = {},
) {
  return {
    ...channelProviderBase(provider),
    ...overrides,
  };
}

function channelProviderBase(provider: string) {
  return {
    auth_mode: "binding_code",
    configured: true,
    connectable: true,
    connection_status: "not_connected",
    credential_fields: [],
    credential_values: {},
    display_name: "Telegram",
    enabled: true,
    provider,
    unavailable_reason: null,
  };
}

function channelConnection(id: string, provider: string) {
  return {
    id,
    external_account_id: "account-1",
    external_account_name: "Deer User",
    metadata: {},
    provider,
    scopes: [],
    status: "connected",
    workspace_id: null,
    workspace_name: null,
  };
}
