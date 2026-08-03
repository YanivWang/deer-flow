import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useChatHistoryPagination,
  type ChatHistoryPaginationController,
} from "../../../../app/features/chat/history/use-chat-history-pagination";
import type { useThreadHistory } from "../../../../app/entities/thread/use-thread-history";

type HistoryController = ReturnType<typeof useThreadHistory>;

describe("useChatHistoryPagination", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows only one page request at a time and resets pending after completion", async () => {
    let resolveLoad: (() => void) | undefined;
    const loadMore = vi.fn<() => Promise<void>>(
      () => new Promise<void>((resolve) => { resolveLoad = resolve; }),
    );
    const history = createHistoryController(loadMore);
    let controller: ChatHistoryPaginationController | undefined;
    const Host = defineComponent({
      setup() {
        controller = useChatHistoryPagination({ history });
        return () => h("div");
      },
    });

    mount(Host);
    if (!controller) {
      throw new Error("History pagination controller was not initialized.");
    }
    const firstRequest = controller.loadMoreHistory();
    const duplicateRequest = controller.loadMoreHistory();

    expect(loadMore).toHaveBeenCalledTimes(1);
    expect(controller.historyIsLoading.value).toBe(true);

    if (!resolveLoad) {
      throw new Error("History pagination request was not started.");
    }
    resolveLoad();
    await Promise.all([firstRequest, duplicateRequest]);

    expect(controller.historyIsLoading.value).toBe(false);
  });

  it("clears pending after a failed request so the user can retry", async () => {
    const loadMore = vi.fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("history unavailable"))
      .mockResolvedValueOnce(undefined);
    const history = createHistoryController(loadMore);
    let controller: ChatHistoryPaginationController | undefined;
    const Host = defineComponent({
      setup() {
        controller = useChatHistoryPagination({ history });
        return () => h("div");
      },
    });

    mount(Host);
    if (!controller) {
      throw new Error("History pagination controller was not initialized.");
    }
    await expect(controller.loadMoreHistory()).rejects.toThrow("history unavailable");
    expect(controller.historyIsLoading.value).toBe(false);

    await controller.loadMoreHistory();
    expect(loadMore).toHaveBeenCalledTimes(2);
  });

  it("observes the sentinel, loads when visible, replaces observers, and disconnects on unmount", async () => {
    class FakeIntersectionObserver {
      static instances: FakeIntersectionObserver[] = [];
      readonly observe = vi.fn();
      readonly disconnect = vi.fn();

      constructor(private readonly callback: IntersectionObserverCallback) {
        FakeIntersectionObserver.instances.push(this);
      }

      trigger(isIntersecting: boolean): void {
        this.callback(
          [{ isIntersecting } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
    }
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

    const loadMore = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const history = createHistoryController(loadMore);
    let controller: ChatHistoryPaginationController | undefined;
    const Host = defineComponent({
      setup() {
        controller = useChatHistoryPagination({ history });
        return () => h("div", { ref: controller.setHistoryLoadMoreSentinel });
      },
    });

    const wrapper = mount(Host);
    if (!controller) {
      throw new Error("History pagination controller was not initialized.");
    }
    const firstObserver = FakeIntersectionObserver.instances.at(-1);
    if (!firstObserver) {
      throw new Error("History pagination observer was not initialized.");
    }
    expect(firstObserver.observe).toHaveBeenCalledTimes(1);

    controller.setHistoryLoadMoreSentinel(document.createElement("div"));
    const secondObserver = FakeIntersectionObserver.instances.at(-1);
    if (!secondObserver) {
      throw new Error("Replacement history pagination observer was not initialized.");
    }
    expect(firstObserver.disconnect).toHaveBeenCalled();

    secondObserver.trigger(true);
    await flushPromises();
    expect(loadMore).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    expect(secondObserver.disconnect).toHaveBeenCalled();
  });
});

function createHistoryController(loadMore: () => Promise<void>): HistoryController {
  return {
    hasMore: ref(true),
    isLoading: ref(false),
    loadMore,
  } as unknown as HistoryController;
}
