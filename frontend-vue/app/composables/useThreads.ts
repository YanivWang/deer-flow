/*
  【文件职责】     Vue Query 的 thread 列表唯一 server-state 所有者与写操作镜像。
  【架构位置】     L3 Vue adapter
  【主要导出】     useThreads
  【依赖关系】     core/threads/infinite · delete · cache-invalidation
  【边界与注意】   主列表永远走 sidecar 过滤后的 raw-offset 分页；不得另存副本。
*/
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/vue-query";
import { computed, reactive } from "vue";

import { getAPIClient } from "@/core/api/api-client";
import { removeDeletedThreadCaches } from "@/core/threads/cache-invalidation";
import {
  fetchInfiniteThreadsPage,
  getInfiniteThreadsNextPageParam,
  INFINITE_THREADS_QUERY_KEY_PREFIX,
  mapInfiniteThreadsCache,
  type InfiniteThreadsParams,
  upsertThreadInInfiniteCache,
  upsertThreadInSearchCache,
} from "@/core/threads/infinite";
import {
  deleteThreadCascade,
  ThreadCascadeDeleteError,
} from "@/core/threads/delete";
import { patchThreadMetadata } from "@/core/threads/api";
import { mergeThreadSnapshot } from "@/core/threads/thread-snapshot";
import type { AgentThread } from "@/core/threads/types";
import {
  isThreadPinned,
  sortPinnedThreads,
  THREAD_PINNED_METADATA_KEY,
} from "@/core/threads/utils";
import { getSessionComposerDraftStorage } from "@/core/threads/composer-draft";
import { clearComposerDrafts } from "@/core/threads/composer-draft-lifecycle";

const THREAD_LIST_PARAMS: InfiniteThreadsParams = {
  sortBy: "updated_at",
  sortOrder: "desc",
  select: ["thread_id", "updated_at", "values", "metadata", "status"],
};

/** The single Vue Query owner for server thread-list state. */
export function useThreads() {
  const queryClient = useQueryClient();
  const apiClient = getAPIClient();
  const queryKey = [
    ...INFINITE_THREADS_QUERY_KEY_PREFIX,
    THREAD_LIST_PARAMS,
  ] as const;
  const query = useInfiniteQuery({
    queryKey,
    enabled: false,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchInfiniteThreadsPage(
        apiClient,
        { ...THREAD_LIST_PARAMS, signal },
        Number(pageParam),
      ),
    /*
      **只传两个参数。** 直接把函数交给 Vue Query，它会按
      `(lastPage, allPages, lastPageParam, allPageParams)` 调用，第三个实参落进
      本函数的 `pageSize`——于是 `pageSize` 变成上一页的 offset（首屏是 0），
      `lastPage.length < pageSize` 永远为假，「还有下一页」永远为真。
      表现是每次加载完列表都会再多问一页，问回来是空的，谁也看不出哪里不对。
      React 那边写的就是显式的两参箭头函数（frontend/src/core/threads/hooks.ts）。
    */
    getNextPageParam: (lastPage, allPages) =>
      getInfiniteThreadsNextPageParam(lastPage, allPages),
  });

  const threads = computed(() => {
    const byId = new Map<string, AgentThread>();
    for (const page of query.data.value?.pages ?? []) {
      for (const thread of page) {
        byId.set(
          thread.thread_id,
          mergeThreadSnapshot(byId.get(thread.thread_id), thread),
        );
      }
    }
    return [...byId.values()];
  });
  const displayedThreads = computed(() => sortPinnedThreads(threads.value));
  let initialLoadRequested = false;

  async function loadInitial(force = false) {
    if (force || !initialLoadRequested) {
      initialLoadRequested = true;
      await query.refetch();
    }
  }

  let loadMorePromise: ReturnType<typeof query.fetchNextPage> | null = null;
  function loadMore() {
    if (
      loadMorePromise ||
      query.isFetchingNextPage.value ||
      !query.hasNextPage.value
    ) {
      return loadMorePromise ?? Promise.resolve();
    }
    loadMorePromise = query.fetchNextPage().finally(() => {
      loadMorePromise = null;
    });
    return loadMorePromise;
  }

  function upsert(thread: AgentThread) {
    const existing = threads.value.find(
      (candidate) => candidate.thread_id === thread.thread_id,
    );
    if (existing) {
      const merged = mergeThreadSnapshot(existing, thread);
      updateCachedThread(thread.thread_id, (cached) =>
        mergeThreadSnapshot(cached, merged),
      );
      return;
    }
    if (!queryClient.getQueryData(queryKey)) {
      queryClient.setQueryData(queryKey, {
        pages: [[thread]],
        pageParams: [0],
      });
    }
    upsertThreadInSearchCache(queryClient, thread);
    upsertThreadInInfiniteCache(queryClient, thread);
  }

  function updateCachedThread(
    threadId: string,
    updater: (thread: AgentThread) => AgentThread,
  ) {
    queryClient.setQueriesData(
      { queryKey: ["threads", "search"], exact: false },
      (oldData: AgentThread[] | undefined) =>
        oldData?.map((thread) =>
          thread.thread_id === threadId ? updater(thread) : thread,
        ),
    );
    queryClient.setQueriesData(
      { queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX, exact: false },
      (oldData: InfiniteData<AgentThread[]> | undefined) =>
        mapInfiniteThreadsCache(oldData, (thread) =>
          thread.thread_id === threadId ? updater(thread) : thread,
        ),
    );
  }

  function upsertCreated(
    threadId: string,
    title: string,
    agentName?: string | null,
  ) {
    const now = new Date().toISOString();
    upsert({
      thread_id: threadId,
      created_at: now,
      updated_at: now,
      metadata: agentName ? { agent_name: agentName } : {},
      status: "idle",
      values: { title, messages: [] },
      interrupts: {},
      context: agentName
        ? {
            thread_id: threadId,
            agent_name: agentName,
            model_name: undefined,
            thinking_enabled: false,
            is_plan_mode: false,
            subagent_enabled: false,
          }
        : undefined,
    });
  }

  async function setPinned(threadId: string, pinned: boolean) {
    await patchThreadMetadata(threadId, {
      [THREAD_PINNED_METADATA_KEY]: pinned,
    });
    const existing = threads.value.find(
      (thread) => thread.thread_id === threadId,
    );
    if (existing) {
      updateCachedThread(threadId, (thread) => ({
        ...thread,
        metadata: {
          ...thread.metadata,
          [THREAD_PINNED_METADATA_KEY]: pinned,
        },
      }));
    }
  }

  async function remove(threadId: string) {
    try {
      const deletedIds = await deleteThreadCascade(apiClient, threadId);
      removeDeletedThreadCaches(queryClient, deletedIds);
      for (const deletedId of deletedIds) {
        clearComposerDrafts(
          getSessionComposerDraftStorage() as Storage | null,
          {
            threadId: deletedId,
          },
        );
      }
    } catch (error) {
      if (error instanceof ThreadCascadeDeleteError) {
        removeDeletedThreadCaches(queryClient, error.deletedThreadIds);
        for (const deletedId of error.deletedThreadIds) {
          clearComposerDrafts(
            getSessionComposerDraftStorage() as Storage | null,
            { threadId: deletedId },
          );
        }
      }
      throw error;
    }
  }

  async function rename(threadId: string, title: string) {
    await apiClient.threads.updateState(threadId, { values: { title } });
    const existing = threads.value.find(
      (thread) => thread.thread_id === threadId,
    );
    if (existing)
      updateCachedThread(threadId, (thread) => ({
        ...thread,
        values: { ...thread.values, title },
      }));
  }

  return reactive({
    threads,
    displayedThreads,
    hasMore: computed(() => Boolean(query.hasNextPage.value)),
    loading: computed(() => query.isFetching.value),
    error: query.error,
    loadInitial,
    loadMore,
    upsert,
    upsertCreated,
    setPinned,
    remove,
    rename,
    isPinned: isThreadPinned,
  });
}
