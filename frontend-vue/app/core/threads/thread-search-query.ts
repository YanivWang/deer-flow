/*
  【文件职责】     见下方源码；本文件由 frontend/src/core/threads/thread-search-query.ts retype 而来。
  【对应 frontend/】 frontend/src/core/threads/thread-search-query.ts
  【架构位置】     L3
  【主要导出】     ThreadSearchParams / DEFAULT_THREAD_SEARCH_PARAMS / THREAD_SEARCH_REFETCH_INTERVAL_MS / shouldIncludeSidecarThreads / filterThreadSearchResults / buildThreadsSearchQueryOptions
  【依赖关系】     见下方 import；改写清单由 scripts/land-retyped.mjs 声明
  【边界与注意】   RETYPED：内容**不是**上游逐字节等同，因此不参与 COPIED hash 护城河。
                   相对上游的改动只有这些：SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk/client → @/core/types/message）
                   勿手改——`make land-retyped-check` 会红；确需手改就登记进
                   land-retyped.mjs 的 HAND_MAINTAINED 并写明理由。
*/

import type { ThreadsClient } from "@/core/types/message";

import {
  SIDECAR_METADATA_KEY,
  shouldShowInPrimaryThreadLists,
} from "@/core/sidecar/thread";

import type { AgentThread, AgentThreadState } from "./types";

type ThreadsSearchClient = {
  threads: {
    search: ThreadsClient["search"];
  };
};

export type ThreadSearchParams = NonNullable<
  Parameters<ThreadsClient["search"]>[0]
>;

export const DEFAULT_THREAD_SEARCH_PARAMS: ThreadSearchParams = {
  limit: 50,
  sortBy: "updated_at",
  sortOrder: "desc",
  select: ["thread_id", "updated_at", "values", "metadata"],
};

export const THREAD_SEARCH_REFETCH_INTERVAL_MS = 5000;

type ThreadSearchFilterParams = Pick<ThreadSearchParams, "metadata">;

export function shouldIncludeSidecarThreads(params: ThreadSearchFilterParams) {
  const metadata = params.metadata;
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    Reflect.get(metadata, SIDECAR_METADATA_KEY) === true
  );
}

export function filterThreadSearchResults(
  threads: AgentThread[],
  params: ThreadSearchFilterParams,
) {
  if (shouldIncludeSidecarThreads(params)) {
    return threads;
  }
  return threads.filter(shouldShowInPrimaryThreadLists);
}

export function buildThreadsSearchQueryOptions(
  apiClient: ThreadsSearchClient,
  params: ThreadSearchParams = DEFAULT_THREAD_SEARCH_PARAMS,
) {
  return {
    queryKey: ["threads", "search", params],
    queryFn: async () => {
      const maxResults = params.limit;
      const initialOffset = params.offset ?? 0;
      const DEFAULT_PAGE_SIZE = 50;

      // Preserve prior semantics: if a non-positive limit is explicitly provided,
      // delegate to a single search call with the original parameters.
      if (maxResults !== undefined && maxResults <= 0) {
        const response =
          await apiClient.threads.search<AgentThreadState>(params);
        return filterThreadSearchResults(response as AgentThread[], params);
      }

      const pageSize =
        typeof maxResults === "number" && maxResults > 0
          ? Math.min(DEFAULT_PAGE_SIZE, maxResults)
          : DEFAULT_PAGE_SIZE;

      const threads: AgentThread[] = [];
      let offset = initialOffset;

      while (true) {
        if (typeof maxResults === "number" && threads.length >= maxResults) {
          break;
        }

        const currentLimit =
          typeof maxResults === "number"
            ? Math.min(pageSize, maxResults - threads.length)
            : pageSize;

        if (typeof maxResults === "number" && currentLimit <= 0) {
          break;
        }

        const response = (await apiClient.threads.search<AgentThreadState>({
          ...params,
          limit: currentLimit,
          offset,
        })) as AgentThread[];

        threads.push(...filterThreadSearchResults(response, params));

        if (response.length < currentLimit) {
          break;
        }

        offset += response.length;
      }

      return threads;
    },
    refetchInterval: THREAD_SEARCH_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  };
}
