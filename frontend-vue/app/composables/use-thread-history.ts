import { useInfiniteQuery } from "@tanstack/vue-query";
import type { MaybeRefOrGetter } from "vue";
import { computed, ref, toValue, watch } from "vue";

import {
  buildVisibleHistoryMessages,
  fetchThreadMessagesPage,
  flattenThreadHistoryPages,
  getThreadHistoryNextPageParam,
  reconcileThreadHistoryRows,
} from "../core/api/thread/client";
import type { RunMessage } from "../core/api/thread/types";

export function useThreadHistory(threadId: MaybeRefOrGetter<string>) {
  const resolvedThreadId = computed(() => toValue(threadId));
  const retainedHistory = ref<{ threadId: string; rows: RunMessage[] }>({
    rows: [],
    threadId: resolvedThreadId.value,
  });

  const query = useInfiniteQuery({
    queryKey: computed(() => ["thread-messages", resolvedThreadId.value]),
    enabled: computed(() => Boolean(resolvedThreadId.value)),
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam, signal }) =>
      fetchThreadMessagesPage(resolvedThreadId.value, pageParam, { signal }),
    getNextPageParam: getThreadHistoryNextPageParam,
  });

  const currentRows = computed(() => flattenThreadHistoryPages(query.data.value?.pages ?? []));
  const previousRows = computed(() =>
    retainedHistory.value.threadId === resolvedThreadId.value ? retainedHistory.value.rows : [],
  );
  const isAuthoritativeComplete = computed(() => {
    const pages = query.data.value?.pages ?? [];
    return (
      query.isSuccess.value &&
      !query.isFetching.value &&
      pages.length > 0 &&
      pages.at(-1)?.has_more === false
    );
  });
  const rows = computed(() =>
    reconcileThreadHistoryRows(
      previousRows.value,
      currentRows.value,
      isAuthoritativeComplete.value,
    ),
  );
  const messages = computed(() => buildVisibleHistoryMessages(rows.value));

  watch(
    [resolvedThreadId, rows],
    ([nextThreadId, nextRows]) => {
      if (retainedHistory.value.threadId === nextThreadId && retainedHistory.value.rows === nextRows) {
        return;
      }
      retainedHistory.value = {
        rows: nextRows,
        threadId: nextThreadId,
      };
    },
    { immediate: true },
  );

  return {
    hasMore: computed(() => Boolean(query.hasNextPage.value)),
    isLoading: computed(() => query.isLoading.value || query.isFetchingNextPage.value),
    loadMore: query.fetchNextPage,
    messages,
    query,
    rows,
  };
}
