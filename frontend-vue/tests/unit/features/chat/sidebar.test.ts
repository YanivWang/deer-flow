import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useChatSidebarPagination,
  type ChatSidebarPaginationController,
} from "../../../../app/features/chat/sidebar/use-chat-sidebar-pagination";
import type { useThreadList } from "../../../../app/entities/thread/use-thread-list";

type ThreadListController = ReturnType<typeof useThreadList>;

describe("useChatSidebarPagination", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows one sidebar page request at a time and resets pending after completion", async () => {
    let resolveLoad: (() => void) | undefined;
    const loadMoreThreads = vi.fn<() => Promise<void>>(
      () => new Promise<void>((resolve) => { resolveLoad = resolve; }),
    );
    const threadList = createThreadListController(loadMoreThreads);
    let controller: ChatSidebarPaginationController | undefined;
    const Host = defineComponent({
      setup() {
        controller = useChatSidebarPagination({ threadList });
        return () => h("div");
      },
    });

    mount(Host);
    if (!controller) {
      throw new Error("Sidebar pagination controller was not initialized.");
    }
    const firstRequest = controller.loadMoreThreads();
    const duplicateRequest = controller.loadMoreThreads();

    expect(loadMoreThreads).toHaveBeenCalledTimes(1);
    expect(controller.isLoadingMoreThreads.value).toBe(true);

    if (!resolveLoad) {
      throw new Error("Sidebar pagination request was not started.");
    }
    resolveLoad();
    await Promise.all([firstRequest, duplicateRequest]);

    expect(controller.isLoadingMoreThreads.value).toBe(false);
  });

  it("clears pending after a failed request so the sidebar action can retry", async () => {
    const loadMoreThreads = vi.fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("sidebar unavailable"))
      .mockResolvedValueOnce(undefined);
    const threadList = createThreadListController(loadMoreThreads);
    let controller: ChatSidebarPaginationController | undefined;
    const Host = defineComponent({
      setup() {
        controller = useChatSidebarPagination({ threadList });
        return () => h("div");
      },
    });

    mount(Host);
    if (!controller) {
      throw new Error("Sidebar pagination controller was not initialized.");
    }
    await expect(controller.loadMoreThreads()).rejects.toThrow("sidebar unavailable");
    expect(controller.isLoadingMoreThreads.value).toBe(false);

    await controller.loadMoreThreads();
    expect(loadMoreThreads).toHaveBeenCalledTimes(2);
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

    const loadMoreThreads = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const threadList = createThreadListController(loadMoreThreads);
    let controller: ChatSidebarPaginationController | undefined;
    const Host = defineComponent({
      setup() {
        controller = useChatSidebarPagination({ threadList });
        return () => h("div", { ref: controller?.setRecentChatSentinel });
      },
    });

    const wrapper = mount(Host);
    if (!controller) {
      throw new Error("Sidebar pagination controller was not initialized.");
    }
    const firstObserver = FakeIntersectionObserver.instances.at(-1);
    if (!firstObserver) {
      throw new Error("Sidebar pagination observer was not initialized.");
    }
    expect(firstObserver.observe).toHaveBeenCalledTimes(1);

    controller.setRecentChatSentinel(document.createElement("div"));
    const secondObserver = FakeIntersectionObserver.instances.at(-1);
    if (!secondObserver) {
      throw new Error("Replacement sidebar pagination observer was not initialized.");
    }
    expect(firstObserver.disconnect).toHaveBeenCalled();

    secondObserver.trigger(true);
    await flushPromises();
    expect(loadMoreThreads).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    expect(secondObserver.disconnect).toHaveBeenCalled();
  });
});

function createThreadListController(
  loadMoreThreads: () => Promise<void>,
): ThreadListController {
  return {
    hasMoreThreads: ref(true),
    isLoadingMoreThreads: ref(false),
    loadMoreThreads,
  } as unknown as ThreadListController;
}
