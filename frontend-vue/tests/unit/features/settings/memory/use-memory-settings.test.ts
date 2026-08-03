import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMemorySettings } from "../../../../../app/features/settings/memory/use-memory-settings";

describe("useMemorySettings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("waits for the memory section to become active before loading facts", async () => {
    const fetchMock = vi.fn(async () => Response.json(memory()));
    vi.stubGlobal("fetch", fetchMock);
    const enabled = ref(false);
    const wrapper = mountMemoryHarness(enabled);
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();

    enabled.value = true;
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/memory",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(wrapper.get('[data-testid="facts"]').text()).toBe("1");
  });

  it("creates and deletes facts while updating the memory query cache", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/memory" && !init?.method) {
        return Response.json(memory({ facts: [] }));
      }
      if (url === "/api/memory/facts" && init?.method === "POST") {
        return Response.json(memory());
      }
      if (url === "/api/memory/facts/fact-1" && init?.method === "DELETE") {
        return Response.json(memory({ facts: [] }));
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountMemoryHarness(ref(true));
    await flushPromises();

    expect(wrapper.get('[data-testid="facts"]').text()).toBe("0");
    await wrapper.get('[data-testid="create"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="facts"]').text()).toBe("1");
    await wrapper.get('[data-testid="delete"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="facts"]').text()).toBe("0");
  });

  it("updates, imports, exports, and clears memory through composable actions", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/memory" && !init?.method) {
        return Response.json(memory());
      }
      if (url === "/api/memory/facts/fact-1" && init?.method === "PATCH") {
        return Response.json(memory({ facts: [memoryFact("fact-1", "Prefer Nuxt", 0.9)] }));
      }
      if (url === "/api/memory/export" && !init?.method) {
        return Response.json(memory({ facts: [memoryFact("fact-1", "Prefer Nuxt", 0.9)] }));
      }
      if (url === "/api/memory/import" && init?.method === "POST") {
        return Response.json(memory({ facts: [memoryFact("fact-2", "Imported", 0.7)] }));
      }
      if (url === "/api/memory" && init?.method === "DELETE") {
        return Response.json(memory({ facts: [] }));
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountMemoryHarness(ref(true));
    await flushPromises();

    await wrapper.get('[data-testid="update"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="first-fact"]').text()).toBe("Prefer Nuxt");

    await wrapper.get('[data-testid="export"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="import"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="first-fact"]').text()).toBe("Imported");

    await wrapper.get('[data-testid="clear"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="facts"]').text()).toBe("0");
  });
});

function mountMemoryHarness(enabled = ref(true)) {
  const Probe = defineComponent({
    setup() {
      const memorySettings = useMemorySettings(enabled);
      return () =>
        h("div", [
          h("p", { "data-testid": "facts" }, String(memorySettings.facts.value.length)),
          h(
            "p",
            { "data-testid": "first-fact" },
            memorySettings.facts.value.at(0)?.content ?? "-",
          ),
          h(
            "button",
            {
              "data-testid": "create",
              onClick: () =>
                memorySettings.createFact({
                  category: "preference",
                  confidence: 0.8,
                  content: "Use Vue",
                }),
            },
            "create",
          ),
          h(
            "button",
            {
              "data-testid": "delete",
              onClick: () => memorySettings.deleteFact("fact-1"),
            },
            "delete",
          ),
          h(
            "button",
            {
              "data-testid": "update",
              onClick: () =>
                memorySettings.updateFact({
                  factId: "fact-1",
                  input: { confidence: 0.9, content: "Prefer Nuxt" },
                }),
            },
            "update",
          ),
          h(
            "button",
            {
              "data-testid": "export",
              onClick: () => memorySettings.exportAllMemory(),
            },
            "export",
          ),
          h(
            "button",
            {
              "data-testid": "import",
              onClick: () => memorySettings.importAllMemory(memory()),
            },
            "import",
          ),
          h(
            "button",
            {
              "data-testid": "clear",
              onClick: () => memorySettings.clearAllMemory(),
            },
            "clear",
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
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function memory(overrides: { facts?: unknown[] } = {}) {
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
    facts: overrides.facts ?? [
      {
        id: "fact-1",
        content: "Use Vue",
        category: "preference",
        confidence: 0.8,
        createdAt: "2026-08-01T00:00:00Z",
        source: "manual",
      },
    ],
  };
}

function memoryFact(id: string, content: string, confidence: number) {
  return {
    id,
    content,
    category: "preference",
    confidence,
    createdAt: "2026-08-01T00:00:00Z",
    source: "manual",
  };
}

