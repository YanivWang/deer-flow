import { describe, expect, it, vi } from "vitest";

import {
  loadMcpConfig,
  resetMcpToolsCache,
  updateMcpServerState,
  updateMcpConfig,
  type McpConfigRequestError,
} from "../../../../../app/core/api/mcp/client";

describe("MCP API client", () => {
  it("loads MCP configuration from the Gateway route", async () => {
    const fetchMock = vi.fn(async () => Response.json(mcpConfig()));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadMcpConfig()).resolves.toMatchObject({
      mcp_servers: {
        github: { enabled: true },
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/mcp/config",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("patches one MCP server enabled state with JSON and CSRF headers", async () => {
    document.cookie = "csrf_token=mcp-csrf";
    const fetchMock = vi.fn(async () =>
      Response.json(mcpConfig({ github: { description: "GitHub", enabled: false } })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateMcpServerState("github", false);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/mcp/config",
      expect.objectContaining({
        body: JSON.stringify({ enabled: false, server_name: "github" }),
        credentials: "include",
        method: "PATCH",
      }),
    );
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("X-CSRF-Token")).toBe(
      "mcp-csrf",
    );
  });

  it("replaces the MCP config with PUT and resets the MCP tools cache", async () => {
    document.cookie = "csrf_token=mcp-csrf";
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(Response.json(mcpConfig()))
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          message: "MCP tools cache reset. Tools will reload on next use.",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await updateMcpConfig(mcpConfig());
    await resetMcpToolsCache();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/mcp/config");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify(mcpConfig()),
        credentials: "include",
        method: "PUT",
      }),
    );
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("X-CSRF-Token")).toBe(
      "mcp-csrf",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/mcp/cache/reset");
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        credentials: "include",
        method: "POST",
      }),
    );
  });

  it("marks 403 responses as admin-required errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { detail: "Admin privileges required to manage MCP configuration." },
          { status: 403 },
        ),
      ),
    );

    await expect(loadMcpConfig()).rejects.toMatchObject({
      isAdminRequired: true,
      message: "Admin privileges required to manage MCP configuration.",
      status: 403,
    } satisfies Partial<McpConfigRequestError>);
  });
});

function mcpConfig(
  servers: Record<string, { description: string; enabled: boolean }> = {
    github: { description: "GitHub MCP server", enabled: true },
  },
) {
  return {
    mcp_servers: servers,
  };
}
