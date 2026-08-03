import { computed, onBeforeUnmount, ref, watch, type ComponentPublicInstance } from "vue";

import { formatThreadUpdatedAt } from "../../entities/thread/model";
import { useThreadList } from "../../entities/thread/use-thread-list";

export function useChatListPage() {
  const threadList = useThreadList();
  const searchText = ref("");
  const isSearching = computed(() => searchText.value.trim().length > 0);
  const filteredThreads = computed(() => {
    const query = searchText.value.toLowerCase();
    return threadList.threads.value.filter((thread) =>
      threadList.titleOfThread(thread).toLowerCase().includes(query),
    );
  });
  const visibleThreads = computed(() =>
    filteredThreads.value.length <= 10
      ? filteredThreads.value.slice(0, 5)
      : filteredThreads.value,
  );

  let observedElement: Element | null = null;
  let observer: IntersectionObserver | null = null;

  function disconnectObserver(): void {
    observer?.disconnect();
    observer = null;
  }

  function observeSentinel(element: Element | ComponentPublicInstance | null): void {
    disconnectObserver();
    const target = typeof Element !== "undefined" && element instanceof Element ? element : null;
    observedElement = target;
    if (!target || isSearching.value || !threadList.hasMoreThreads.value) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry?.isIntersecting &&
          threadList.hasMoreThreads.value &&
          !threadList.isLoadingMoreThreads.value
        ) {
          void threadList.loadMoreThreads();
        }
      },
      { rootMargin: "200px 0px 200px 0px" },
    );
    observer.observe(target);
  }

  watch(
    [isSearching, threadList.hasMoreThreads, threadList.isLoadingMoreThreads],
    () => {
      if (observedElement) {
        observeSentinel(observedElement);
      }
    },
    { flush: "post" },
  );

  onBeforeUnmount(disconnectObserver);

  function setSearchText(value: string): void {
    searchText.value = value;
  }

  return {
    filteredThreads,
    formatThreadUpdatedAt,
    isLoadingThreads: threadList.query.isLoading,
    isLoadingMoreThreads: threadList.isLoadingMoreThreads,
    isSearching,
    hasMoreThreads: threadList.hasMoreThreads,
    loadMoreThreads: threadList.loadMoreThreads,
    observeSentinel,
    pathOfThread: threadList.pathOfThread,
    searchText,
    setSearchText,
    titleOfThread: threadList.titleOfThread,
    channelSourceOfThread: threadList.channelSourceOfThread,
    isThreadPinned: threadList.isThreadPinned,
    threads: threadList.threads,
    visibleThreads,
  };
}

export type ChatListPageController = ReturnType<typeof useChatListPage>;
