import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import type { useThreadHistory } from "../../../entities/thread/use-thread-history";

type ThreadHistoryController = ReturnType<typeof useThreadHistory>;

export function useChatHistoryPagination(options: { history: ThreadHistoryController }) {
  const paginationLoading = ref(false);
  const historyLoadMoreSentinel = ref<Element | null>(null);
  let historyLoadMoreObserver: IntersectionObserver | null = null;

  const historyHasMore = computed(() => options.history.hasMore.value);
  const historyIsLoading = computed(
    () => options.history.isLoading.value || paginationLoading.value,
  );

  function disconnectHistoryLoadMoreObserver(): void {
    historyLoadMoreObserver?.disconnect();
    historyLoadMoreObserver = null;
  }

  async function loadMoreHistory(): Promise<void> {
    if (paginationLoading.value || !options.history.hasMore.value) {
      return;
    }
    paginationLoading.value = true;
    try {
      await options.history.loadMore();
    } finally {
      paginationLoading.value = false;
    }
  }

  function observeHistoryLoadMoreSentinel(): void {
    disconnectHistoryLoadMoreObserver();
    const sentinel = historyLoadMoreSentinel.value;
    if (
      !sentinel
      || !options.history.hasMore.value
      || typeof IntersectionObserver === "undefined"
    ) {
      return;
    }
    historyLoadMoreObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadHistoryFromSentinel().catch(() => undefined);
      }
    }, { rootMargin: "120px 0px 0px 0px" });
    historyLoadMoreObserver.observe(sentinel);
  }

  function setHistoryLoadMoreSentinel(element: unknown): void {
    historyLoadMoreSentinel.value = isElement(element) ? element : null;
    observeHistoryLoadMoreSentinel();
  }

  async function loadHistoryFromSentinel(): Promise<void> {
    await loadMoreHistory();
    if (options.history.hasMore.value) {
      await nextTick();
      observeHistoryLoadMoreSentinel();
    }
  }

  onMounted(() => {
    observeHistoryLoadMoreSentinel();
  });

  watch(historyHasMore, async (hasMore) => {
    if (!hasMore) {
      disconnectHistoryLoadMoreObserver();
      return;
    }
    await nextTick();
    observeHistoryLoadMoreSentinel();
    if (typeof IntersectionObserver !== "undefined") {
      void loadHistoryFromSentinel().catch(() => undefined);
    }
  });

  onBeforeUnmount(() => {
    disconnectHistoryLoadMoreObserver();
  });

  return {
    historyHasMore,
    historyIsLoading,
    loadMoreHistory,
    setHistoryLoadMoreSentinel,
  };
}

function isElement(value: unknown): value is Element {
  return typeof Element !== "undefined" && value instanceof Element;
}

export type ChatHistoryPaginationController = ReturnType<typeof useChatHistoryPagination>;
