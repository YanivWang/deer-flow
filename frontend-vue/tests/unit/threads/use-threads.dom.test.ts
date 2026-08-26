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
  /*
    短页 = 没有下一页。这一条钉的是 `getNextPageParam` 的**实参个数**：把函数直接
    交给 Vue Query，它会多传 `lastPageParam`，那个值会落进 `pageSize` 形参，于是
    「本页不满」的判断永远为假、`hasMore` 永远为真——列表每次加载完都会再多问一页。
  */
  it("stops paginating once the backend returns a short page", async () => {
    apiClient.threads.search
      .mockReset()
      .mockResolvedValue([thread("only-1"), thread("only-2")]);
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

    expect(apiClient.threads.search).toHaveBeenCalledTimes(1);
    // 返回值是 reactive(...)，ref 已经解包，所以直接读属性。
    expect(threads!.hasMore).toBe(false);
    await threads!.loadMore();
    await flushPromises();
    expect(apiClient.threads.search).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    queryClient.clear();
  });

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
