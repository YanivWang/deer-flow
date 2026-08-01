import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMcpSettings } from "../../../app/composables/use-mcp-settings";

describe("useMcpSettings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("waits for the tools section to become active before loading MCP config", async () => {
    const fetchMock = vi.fn(async () => Response.json(mcpConfig()));
    vi.stubGlobal("fetch", fetchMock);
    const enabled = ref(false);
    const wrapper = mountMcpHarness(enabled);
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();

    enabled.value = true;
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/mcp/config",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(wrapper.get('[data-testid="servers"]').text()).toBe("1");
  });

  it("updates the cached server list after toggling one MCP server", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/mcp/config" && !init?.method) {
        return Response.json(mcpConfig());
      }
      if (url === "/api/mcp/config" && init?.method === "PATCH") {
        return Response.json(
          mcpConfig({ github: { description: "GitHub MCP server", enabled: false } }),
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountMcpHarness(ref(true));
    await flushPromises();

    expect(wrapper.get('[data-testid="enabled"]').text()).toBe("true");
    await wrapper.get('[data-testid="toggle"]').trigger("click");
    await flushPromises();

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      enabled: false,
      server_name: "github",
    });
    expect(wrapper.get('[data-testid="enabled"]').text()).toBe("false");
  });

  it("saves full config edits and resets the MCP tools cache", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/mcp/config" && !init?.method) {
        return Response.json(mcpConfig());
      }
      if (url === "/api/mcp/config" && init?.method === "PUT") {
        return Response.json(
          mcpConfig({ github: { description: "GitHub MCP server", enabled: false } }),
        );
      }
      if (url === "/api/mcp/cache/reset" && init?.method === "POST") {
        return Response.json({ success: true, message: "reset" });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountMcpHarness(ref(true));
    await flushPromises();

    await wrapper.get('[data-testid="save"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="enabled"]').text()).toBe("false");

    await wrapper.get('[data-testid="reset"]').trigger("click");
    await flushPromises();
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/mcp/cache/reset")).toBe(true);
  });
});

function mountMcpHarness(enabled = ref(true)) {
  const Probe = defineComponent({
    setup() {
      const settings = useMcpSettings(enabled);
      return () =>
        h("div", [
          h("p", { "data-testid": "servers" }, String(settings.serverEntries.value.length)),
          h(
            "p",
            { "data-testid": "enabled" },
            String(settings.serverEntries.value[0]?.config.enabled ?? null),
          ),
          h(
            "button",
            {
              "data-testid": "toggle",
              onClick: () => settings.setServerEnabled({ enabled: false, serverName: "github" }),
            },
            "toggle",
          ),
          h(
            "button",
            {
              "data-testid": "save",
              onClick: () =>
                settings.saveConfig(
                  mcpConfig({ github: { description: "GitHub MCP server", enabled: false } }),
                ),
            },
            "save",
          ),
          h(
            "button",
            {
              "data-testid": "reset",
              onClick: () => settings.resetCache(),
            },
            "reset",
          ),
        ]);
    },
  });

  return mount(Probe, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
    },
  });
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function mcpConfig(
  servers: Record<string, { description: string; enabled: boolean }> = {
    github: { description: "GitHub MCP server", enabled: true },
  },
) {
  return {
    mcp_servers: servers,
  };
}
