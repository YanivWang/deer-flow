/*
  【文件职责】     thread 历史的 vue-query 无限查询与跨刷新对账（05 C1 / C6）。
  【架构位置】     L3（Vue 适配）
  【主要导出】     useThreadHistory
  【依赖关系】     @tanstack/vue-query · @/core/threads/history · message-identity
  【边界与注意】   上游用 `useState` + `useEffect` 保留上一次的行集（C6：历史失效时
                   保留已加载的页）。Vue 侧用普通 `ref` 加一次 `watch(..., {
                   immediate: true })`——**`immediate` 不能省（05 M5）**：
                   保留态的第一帧就是「刚拿到第一页」，惰性 watch 会让第一页
                   永远不进保留区，表现是第一次后台刷新就把首屏抹掉。

                   `threadId` 收 `MaybeRefOrGetter` 而不是 string：查询 key 必须
                   随 thread 变，写成裸 string 的话切 thread 不重新取数——
                   这是 vue-query 与 react-query 最容易踩错的一处差异。
*/

import { useInfiniteQuery } from "@tanstack/vue-query";
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

import { fetch } from "@/core/api/fetcher";
import { readGatewayResponseError } from "@/core/api/errors";
import { getBackendBaseURL } from "@/core/config";
import {
  buildThreadMessagesPageUrl,
  flattenThreadHistoryPages,
  getThreadHistoryNextPageParam,
  parseThreadMessagesPageResponse,
  reconcileThreadHistoryRows,
  THREAD_HISTORY_QUERY_POLICY,
  threadHistoryQueryKey,
  type ThreadMessagesPageResponse,
} from "@/core/threads/history";
import { buildVisibleHistoryMessages } from "@/core/threads/message-identity";
import type { RunMessage } from "@/core/threads/types";

const EMPTY_RUN_MESSAGES: RunMessage[] = [];

export interface UseThreadHistoryOptions {
  enabled?: MaybeRefOrGetter<boolean>;
  pendingSupersededRunIds?: MaybeRefOrGetter<ReadonlySet<string>>;
}

export function useThreadHistory(
  threadId: MaybeRefOrGetter<string>,
  options: UseThreadHistoryOptions = {},
) {
  const { enabled = true, pendingSupersededRunIds } = options;

  const historyQuery = useInfiniteQuery<
    ThreadMessagesPageResponse,
    Error,
    { pages: ThreadMessagesPageResponse[]; pageParams: (number | null)[] },
    readonly unknown[],
    number | null
  >({
    ...THREAD_HISTORY_QUERY_POLICY,
    queryKey: computed(() => threadHistoryQueryKey(toValue(threadId))),
    enabled: computed(() => toValue(enabled) && Boolean(toValue(threadId))),
    initialPageParam: null,
    queryFn: async ({ pageParam, signal }) => {
      const url = buildThreadMessagesPageUrl(
        getBackendBaseURL(),
        toValue(threadId),
        pageParam ?? undefined,
      );
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal,
      });
      if (!response.ok) {
        throw await readGatewayResponseError(
          response,
          "Failed to load thread history.",
        );
      }
      const page = parseThreadMessagesPageResponse(await response.json());
      if (page.data.length > 0 || pageParam !== null) return page;

      const stateResponse = await fetch(
        `${getBackendBaseURL()}/api/langgraph/threads/${encodeURIComponent(toValue(threadId))}/state`,
        { method: "GET", signal },
      );
      if (!stateResponse.ok) return page;
      const state = (await stateResponse.json()) as {
        values?: { messages?: import("@/core/types/message").Message[] };
      };
      const messages = state.values?.messages ?? [];
      return {
        data: messages.map((content, index) => ({
          run_id: `state-${toValue(threadId)}`,
          seq: index + 1,
          content,
          metadata: { caller: "lead_agent" },
          created_at: new Date(0).toISOString(),
        })),
        has_more: false,
        next_before_seq: null,
      };
    },
    getNextPageParam: getThreadHistoryNextPageParam,
  });

  let loadMorePromise: ReturnType<typeof historyQuery.fetchNextPage> | null =
    null;

  function loadMore() {
    if (!historyQuery.hasNextPage.value) return Promise.resolve();
    if (loadMorePromise) return loadMorePromise;
    loadMorePromise = historyQuery.fetchNextPage().finally(() => {
      loadMorePromise = null;
    });
    return loadMorePromise;
  }

  const currentMessageRows = computed(() =>
    flattenThreadHistoryPages(historyQuery.data.value?.pages ?? []),
  );

  const retainedHistory = ref<{ threadId: string; rows: RunMessage[] }>({
    threadId: toValue(threadId),
    rows: EMPTY_RUN_MESSAGES,
  });

  const previousRows = computed(() =>
    retainedHistory.value.threadId === toValue(threadId)
      ? retainedHistory.value.rows
      : EMPTY_RUN_MESSAGES,
  );

  const isAuthoritativeComplete = computed(() => {
    const pages = historyQuery.data.value?.pages ?? [];
    return (
      historyQuery.isSuccess.value &&
      !historyQuery.isFetching.value &&
      pages.length > 0 &&
      pages.at(-1)?.has_more === false
    );
  });

  const messageRows = computed(() =>
    reconcileThreadHistoryRows(
      previousRows.value,
      currentMessageRows.value,
      isAuthoritativeComplete.value,
    ),
  );

  // 05 M5：`immediate` 不是可选项，理由见文件头。
  watch(
    [messageRows, () => toValue(threadId)],
    ([rows, id]) => {
      if (
        retainedHistory.value.threadId === id &&
        retainedHistory.value.rows === rows
      ) {
        return;
      }
      retainedHistory.value = { threadId: id, rows };
    },
    { immediate: true },
  );

  const messages = computed(() =>
    buildVisibleHistoryMessages(
      messageRows.value,
      (pendingSupersededRunIds
        ? toValue(pendingSupersededRunIds)
        : undefined) ?? new Set<string>(),
    ),
  );

  return {
    messages,
    loading: computed(
      () =>
        historyQuery.isLoading.value || historyQuery.isFetchingNextPage.value,
    ),
    loadingInitial: historyQuery.isLoading,
    loadingMore: historyQuery.isFetchingNextPage,
    hasMore: computed(() => Boolean(historyQuery.hasNextPage.value)),
    loadMore,
    error: historyQuery.error,
  };
}
