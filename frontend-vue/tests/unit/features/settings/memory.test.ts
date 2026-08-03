import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSettingsMemory } from "../../../../app/features/settings/memory/use-settings-memory";

describe("useSettingsMemory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps validation in the feature and does not submit invalid facts", async () => {
    const fetchMock = vi.fn(async () => Response.json(memory()));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountMemoryHarness();
    await flushPromises();

    await wrapper.get('[data-testid="submit-invalid"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="error"]').text()).toContain("必填");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed imports before calling the Gateway", async () => {
    const fetchMock = vi.fn(async () => Response.json(memory()));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountMemoryHarness();
    await flushPromises();

    await wrapper.get('[data-testid="import-invalid"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="error"]').text()).toContain("导入 JSON");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function mountMemoryHarness() {
  const Probe = defineComponent({
    setup() {
      const controller = useSettingsMemory(ref(true));
      return () =>
        h("div", [
          h("p", { "data-testid": "error" }, controller.memoryFormError.value),
          h(
            "button",
            {
              "data-testid": "submit-invalid",
              onClick: () => controller.submitMemoryFact(),
            },
            "submit",
          ),
          h(
            "button",
            {
              "data-testid": "import-invalid",
              onClick: () => controller.importMemoryJson(),
            },
            "import",
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

function memory() {
  return {
    version: "1.0",
    lastUpdated: "2026-08-01T00:00:00Z",
    user: {
      workContext: { summary: "", updatedAt: "" },
      personalContext: { summary: "", updatedAt: "" },
      topOfMind: { summary: "", updatedAt: "" },
    },
    history: {
      recentMonths: { summary: "", updatedAt: "" },
      earlierContext: { summary: "", updatedAt: "" },
      longTermBackground: { summary: "", updatedAt: "" },
    },
    facts: [],
  };
}
