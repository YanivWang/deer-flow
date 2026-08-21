import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

import { useThreads } from "@/composables/useThreads";
import type { AgentThread } from "@/core/threads/types";

const apiClient = vi.hoisted(() => ({
  threads: {
    search: vi.fn(),
    delete: vi.fn(),
    updateState: vi.fn(),
  },
}));
vi.mock("@/core/api/api-client", () => ({ getAPIClient: () => apiClient }));

function thread(id: string, sidecar = false): AgentThread {
  return {
    thread_id: id,
    created_at: "2026-08-21T00:00:00Z",
    updated_at: "2026-08-21T00:00:00Z",
    status: "idle",
    metadata: sidecar
      ? { deerflow_sidecar: true, parent_thread_id: "main" }
      : {},
    values: { title: id },
    interrupts: {},
  };
}

describe("useThreads server-state owner", () => {
  it("filters sidecars and advances the second request by raw backend rows", async () => {
    const rawFirstPage = [
      thread("main-1"),
      ...Array.from({ length: 49 }, (_, index) =>
        thread(`side-${index}`, true),
      ),
    ];
    apiClient.threads.search
      .mockReset()
      .mockResolvedValueOnce(rawFirstPage)
      .mockResolvedValueOnce([thread("main-2")]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let threads: ReturnType<typeof useThreads> | undefined;
    const wrapper = mount(
      defineComponent({
        setup() {
          threads = useThreads();
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    );

    await threads!.loadInitial();
    await flushPromises();

    expect(apiClient.threads.search).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ offset: 50, limit: 49 }),
    );
    expect(threads!.displayedThreads.map((item) => item.thread_id)).toEqual([
      "main-1",
      "main-2",
    ]);
    expect(
      threads!.displayedThreads.some(
        (item) => item.metadata?.deerflow_sidecar === true,
      ),
    ).toBe(false);

    wrapper.unmount();
    queryClient.clear();
  });
});
