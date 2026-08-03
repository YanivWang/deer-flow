import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSettingsTools } from "../../../../app/features/settings/tools/use-settings-tools";

describe("useSettingsTools", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps invalid MCP config validation in the feature and skips PUT", async () => {
    const fetchMock = vi.fn(async () => Response.json(mcpConfig()));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountToolsHarness();
    await flushPromises();

    await wrapper.get('[data-testid="set-invalid"]').trigger("click");
    await wrapper.get('[data-testid="save"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="error"]').text()).toContain("mcp_servers");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("formats a successful config save back into the editor state", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/mcp/config" && init?.method === "PUT") {
        return Response.json(mcpConfig({ github: { description: "Edited", enabled: false } }));
      }
      return Response.json(mcpConfig());
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountToolsHarness();
    await flushPromises();

    await wrapper.get('[data-testid="set-valid"]').trigger("click");
    await wrapper.get('[data-testid="save"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="config-text"]').text()).toContain('"Edited"');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true);
  });

  it("tracks editor dirtiness and restores the server snapshot on discard", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(mcpConfig())));
    const wrapper = mountToolsHarness();
    await flushPromises();

    await wrapper.get('[data-testid="set-invalid"]').trigger("click");
    expect(wrapper.get('[data-testid="dirty"]').text()).toBe("dirty");
    await wrapper.get('[data-testid="reset-editor"]').trigger("click");

    expect(wrapper.get('[data-testid="dirty"]').text()).toBe("clean");
    expect(wrapper.get('[data-testid="config-text"]').text()).toContain('"github"');
  });
});

function mountToolsHarness() {
  const Probe = defineComponent({
    setup() {
      const controller = useSettingsTools(ref(true));
      return () =>
        h("div", [
          h("p", { "data-testid": "error" }, controller.mcpFormError.value),
          h("p", { "data-testid": "config-text" }, controller.mcpConfigText.value),
          h("p", { "data-testid": "dirty" }, controller.hasUnsavedChanges.value ? "dirty" : "clean"),
          h(
            "button",
            {
              "data-testid": "set-invalid",
              onClick: () => controller.setMcpConfigText("{}"),
            },
            "invalid",
          ),
          h(
            "button",
            {
              "data-testid": "set-valid",
              onClick: () => controller.setMcpConfigText(JSON.stringify(mcpConfig())),
            },
            "valid",
          ),
          h(
            "button",
            {
              "data-testid": "save",
              onClick: () => controller.submitMcpConfigEdit(),
            },
            "save",
          ),
          h(
            "button",
            { "data-testid": "reset-editor", onClick: controller.resetMcpConfigEditor },
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
    github: { description: "GitHub", enabled: true },
  },
) {
  return { mcp_servers: servers };
}
