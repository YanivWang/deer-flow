import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import type { useThreadList } from "../../../entities/thread/use-thread-list";

type ThreadListController = ReturnType<typeof useThreadList>;

export function useChatSidebarPagination(options: { threadList: ThreadListController }) {
  const paginationLoading = ref(false);
  const recentChatSentinel = ref<Element | null>(null);
  let recentChatObserver: IntersectionObserver | null = null;

  const hasMoreThreads = computed(() => options.threadList.hasMoreThreads.value);
  const isLoadingMoreThreads = computed(
    () => options.threadList.isLoadingMoreThreads.value || paginationLoading.value,
  );

  function disconnectRecentChatObserver(): void {
    recentChatObserver?.disconnect();
    recentChatObserver = null;
  }

  async function loadMoreThreads(): Promise<void> {
    if (
      paginationLoading.value
      || options.threadList.isLoadingMoreThreads.value
      || !options.threadList.hasMoreThreads.value
    ) {
      return;
    }
    paginationLoading.value = true;
    try {
      await options.threadList.loadMoreThreads();
    } finally {
      paginationLoading.value = false;
    }
  }

  function observeRecentChatSentinel(): void {
    disconnectRecentChatObserver();
    const sentinel = recentChatSentinel.value;
    if (
      !sentinel
      || !options.threadList.hasMoreThreads.value
      || typeof IntersectionObserver === "undefined"
    ) {
      return;
    }
    recentChatObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMoreThreadsFromSentinel().catch(() => undefined);
      }
    });
    recentChatObserver.observe(sentinel);
  }

  function setRecentChatSentinel(element: unknown): void {
    recentChatSentinel.value = isElement(element) ? element : null;
    observeRecentChatSentinel();
  }

  async function loadMoreThreadsFromSentinel(): Promise<void> {
    await loadMoreThreads();
    if (options.threadList.hasMoreThreads.value) {
      await nextTick();
      observeRecentChatSentinel();
    }
  }

  onMounted(() => {
    observeRecentChatSentinel();
  });

  watch(hasMoreThreads, async (hasMore) => {
    if (!hasMore) {
      disconnectRecentChatObserver();
      return;
    }
    await nextTick();
    observeRecentChatSentinel();
  });

  onBeforeUnmount(() => {
    disconnectRecentChatObserver();
  });

  return {
    hasMoreThreads,
    isLoadingMoreThreads,
    loadMoreThreads,
    setRecentChatSentinel,
  };
}

function isElement(value: unknown): value is Element {
  return typeof Element !== "undefined" && value instanceof Element;
}

export type ChatSidebarPaginationController = ReturnType<typeof useChatSidebarPagination>;
