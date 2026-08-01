import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/vue-query";
import { computed } from "vue";

import {
  createThread,
  deleteThread,
  patchThreadMetadata,
  renameThread,
  searchThreads,
} from "../core/api/thread/client";
import type { AgentThread } from "../core/api/thread/types";
import {
  channelSourceOfThread,
  isThreadPinned,
  pathOfThread,
  sortPinnedThreads,
  THREAD_PINNED_METADATA_KEY,
  titleOfThread,
} from "../core/api/thread/utils";

export const THREAD_LIST_PAGE_SIZE = 50;
export const THREAD_SEARCH_QUERY_KEY_PREFIX = ["threads", "search"] as const;
export const INFINITE_THREADS_QUERY_KEY_PREFIX = ["threads", "searchInfinite"] as const;

export function useThreadList() {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: [...INFINITE_THREADS_QUERY_KEY_PREFIX, "workspace"],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchThreadListPage(pageParam, THREAD_LIST_PAGE_SIZE, { signal }),
    getNextPageParam: getThreadListNextPageParam,
    refetchOnWindowFocus: false,
  });

  const threads = computed(() => sortPinnedThreads(dedupeThreadPages(query.data.value?.pages ?? [])));

  const createMutation = useMutation({
    mutationFn: ({
      agentName,
      threadId,
    }: {
      agentName?: string | null;
      threadId?: string;
    }) =>
      createThread({
        ...(threadId ? { threadId } : {}),
        metadata: agentName ? { agent_name: agentName } : {},
      }),
    onSuccess(response, variables) {
      upsertThreadInSearchCaches(queryClient, {
        ...response,
        metadata: {
          ...(response.metadata ?? {}),
          ...(variables.agentName ? { agent_name: variables.agentName } : {}),
        },
      });
    },
    onSettled() {
      void queryClient.invalidateQueries({ queryKey: THREAD_SEARCH_QUERY_KEY_PREFIX });
      void queryClient.invalidateQueries({ queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX });
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ threadId, pinned }: { threadId: string; pinned: boolean }) =>
      patchThreadMetadata(threadId, { [THREAD_PINNED_METADATA_KEY]: pinned }),
    onSuccess(response, variables) {
      setThreadInSearchCache(queryClient, variables.threadId, (thread) => ({
        ...thread,
        metadata: {
          ...(thread.metadata ?? {}),
          ...(response.metadata ?? {}),
          [THREAD_PINNED_METADATA_KEY]: variables.pinned,
        },
      }));
    },
    onSettled() {
      void queryClient.invalidateQueries({ queryKey: THREAD_SEARCH_QUERY_KEY_PREFIX });
      void queryClient.invalidateQueries({ queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ threadId, title }: { threadId: string; title: string }) =>
      renameThread(threadId, title),
    onSuccess(_response, variables) {
      setThreadInSearchCache(queryClient, variables.threadId, (thread) => ({
        ...thread,
        values: {
          ...(thread.values ?? {}),
          title: variables.title,
        },
      }));
    },
    onSettled() {
      void queryClient.invalidateQueries({ queryKey: THREAD_SEARCH_QUERY_KEY_PREFIX });
      void queryClient.invalidateQueries({ queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ threadId }: { threadId: string }) => deleteThread(threadId),
    onSuccess(_response, variables) {
      removeThreadsFromSearchCaches(queryClient, new Set([variables.threadId]));
    },
    onSettled() {
      void queryClient.invalidateQueries({ queryKey: THREAD_SEARCH_QUERY_KEY_PREFIX });
      void queryClient.invalidateQueries({ queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX });
    },
  });

  return {
    channelSourceOfThread,
    createThread: createMutation.mutateAsync,
    createThreadErrorMessage: computed(() => messageOfMutationError(createMutation.error.value)),
    deleteThread: deleteMutation.mutateAsync,
    deleteThreadErrorMessage: computed(() => messageOfMutationError(deleteMutation.error.value)),
    hasMoreThreads: computed(() => Boolean(query.hasNextPage.value)),
    isThreadPinned,
    isCreatingThread: computed(() => createMutation.isPending.value),
    isDeletingThread: computed(() => deleteMutation.isPending.value),
    isLoadingMoreThreads: computed(() => query.isFetchingNextPage.value),
    isPinningThread: computed(() => pinMutation.isPending.value),
    isRenamingThread: computed(() => renameMutation.isPending.value),
    loadMoreThreads: query.fetchNextPage,
    pathOfThread,
    pinThreadErrorMessage: computed(() => messageOfMutationError(pinMutation.error.value)),
    pinThread: pinMutation.mutateAsync,
    query,
    renameThreadErrorMessage: computed(() => messageOfMutationError(renameMutation.error.value)),
    renameThread: renameMutation.mutateAsync,
    threads,
    titleOfThread,
  };
}

export async function fetchThreadListPage(
  offset: number,
  pageSize: number = THREAD_LIST_PAGE_SIZE,
  options: { signal?: AbortSignal } = {},
): Promise<AgentThread[]> {
  return searchThreads(
    {
      limit: pageSize,
      offset,
    },
    options,
  );
}

export function getThreadListNextPageParam(
  lastPage: AgentThread[],
  allPages: AgentThread[][],
  pageSize: number = THREAD_LIST_PAGE_SIZE,
): number | undefined {
  if (lastPage.length < pageSize) {
    return undefined;
  }
  return allPages.reduce((sum, page) => sum + page.length, 0);
}

export function dedupeThreadPages(pages: AgentThread[][]): AgentThread[] {
  const seen = new Set<string>();
  const threads: AgentThread[] = [];
  for (const thread of pages.flat()) {
    if (seen.has(thread.thread_id)) {
      continue;
    }
    seen.add(thread.thread_id);
    threads.push(thread);
  }
  return threads;
}

function upsertThreadInSearchCaches(queryClient: QueryClient, createdThread: AgentThread): void {
  queryClient.setQueriesData(
    { exact: false, queryKey: THREAD_SEARCH_QUERY_KEY_PREFIX },
    (oldData: AgentThread[] | undefined) =>
      oldData
        ? [createdThread, ...oldData.filter((thread) => thread.thread_id !== createdThread.thread_id)]
        : oldData,
  );
  queryClient.setQueriesData(
    { exact: false, queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX },
    (oldData: InfiniteData<AgentThread[]> | undefined) => {
      if (!oldData) {
        return oldData;
      }
      const [firstPage = [], ...restPages] = oldData.pages;
      return {
        ...oldData,
        pages: [
          [
            createdThread,
            ...firstPage.filter((thread) => thread.thread_id !== createdThread.thread_id),
          ],
          ...restPages.map((page) =>
            page.filter((thread) => thread.thread_id !== createdThread.thread_id),
          ),
        ],
      };
    },
  );
}

function setThreadInSearchCache(
  queryClient: QueryClient,
  threadId: string,
  mapper: (thread: AgentThread) => AgentThread,
): void {
  queryClient.setQueriesData(
    { exact: false, queryKey: THREAD_SEARCH_QUERY_KEY_PREFIX },
    (oldData: AgentThread[] | undefined) =>
      oldData?.map((thread) => (thread.thread_id === threadId ? mapper(thread) : thread)) ??
      oldData,
  );
  queryClient.setQueriesData(
    { exact: false, queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX },
    (oldData: InfiniteData<AgentThread[]> | undefined) =>
      oldData
        ? {
            ...oldData,
            pages: oldData.pages.map((page) =>
              page.map((thread) => (thread.thread_id === threadId ? mapper(thread) : thread)),
            ),
          }
        : oldData,
  );
}

function removeThreadsFromSearchCaches(queryClient: QueryClient, threadIds: Set<string>): void {
  queryClient.setQueriesData(
    { exact: false, queryKey: THREAD_SEARCH_QUERY_KEY_PREFIX },
    (oldData: AgentThread[] | undefined) =>
      oldData?.filter((thread) => !threadIds.has(thread.thread_id)) ?? oldData,
  );
  queryClient.setQueriesData(
    { exact: false, queryKey: INFINITE_THREADS_QUERY_KEY_PREFIX },
    (oldData: InfiniteData<AgentThread[]> | undefined) =>
      oldData
        ? {
            ...oldData,
            pages: oldData.pages.map((page) =>
              page.filter((thread) => !threadIds.has(thread.thread_id)),
            ),
          }
        : oldData,
  );
}

function messageOfMutationError(error: Error | null): string | null {
  return error?.message ?? null;
}
