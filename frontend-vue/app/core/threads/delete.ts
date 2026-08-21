/*
  【文件职责】     搜索并级联删除主 thread 的全部 sidecar，暴露部分失败重试信息。
  【对应 frontend/】 core/threads/hooks.ts 的 deleteThread
  【架构位置】     L3
  【主要导出】     deleteThreadCascade · findSidecarThreadIdsForParent · error
  【依赖关系】     sidecar/thread · api/errors
  【边界与注意】   sidecar 全成功后才删除主 thread；404 按幂等成功处理。
*/
import { isGatewayResponseError } from "@/core/api/errors";
import { SIDECAR_METADATA_KEY, isSidecarThread } from "@/core/sidecar/thread";
import type { AgentThread, AgentThreadState } from "@/core/threads/types";
import type { ThreadSearchQuery } from "@/core/types/message";

export interface ThreadCascadeClient {
  threads: {
    search(query?: ThreadSearchQuery<AgentThreadState>): Promise<AgentThread[]>;
    delete(threadId: string): Promise<void>;
  };
}

export class ThreadCascadeDeleteError extends Error {
  readonly parentThreadId: string;
  readonly failedThreadIds: string[];
  readonly deletedThreadIds: string[];
  readonly causes: unknown[];

  constructor(options: {
    parentThreadId: string;
    failedThreadIds: string[];
    deletedThreadIds: string[];
    causes: unknown[];
  }) {
    super(
      `Failed to delete ${options.failedThreadIds.length} conversation ${
        options.failedThreadIds.length === 1 ? "thread" : "threads"
      }: ${options.failedThreadIds.join(", ")}. Try again.`,
    );
    this.name = "ThreadCascadeDeleteError";
    this.parentThreadId = options.parentThreadId;
    this.failedThreadIds = options.failedThreadIds;
    this.deletedThreadIds = options.deletedThreadIds;
    this.causes = options.causes;
  }
}

export async function findSidecarThreadIdsForParent(
  apiClient: Pick<ThreadCascadeClient, "threads">,
  parentThreadId: string,
  pageSize = 100,
): Promise<string[]> {
  const ids = new Set<string>();
  let offset = 0;
  const limit = Math.max(1, pageSize);
  while (true) {
    const response = await apiClient.threads.search({
      metadata: {
        [SIDECAR_METADATA_KEY]: true,
        parent_thread_id: parentThreadId,
      },
      limit,
      offset,
      sortBy: "updated_at",
      sortOrder: "desc",
      select: ["thread_id", "metadata"],
    });
    for (const thread of response) {
      if (
        isSidecarThread(thread) &&
        thread.metadata?.parent_thread_id === parentThreadId
      ) {
        ids.add(thread.thread_id);
      }
    }
    if (response.length < limit) break;
    offset += response.length;
  }
  return [...ids];
}

async function deleteIdempotently(
  client: ThreadCascadeClient,
  threadId: string,
): Promise<void> {
  try {
    await client.threads.delete(threadId);
  } catch (error) {
    if (isGatewayResponseError(error) && error.status === 404) return;
    throw error;
  }
}

/** Delete all sidecars concurrently, then the main thread only after success. */
export async function deleteThreadCascade(
  apiClient: ThreadCascadeClient,
  parentThreadId: string,
): Promise<string[]> {
  const sidecarIds = await findSidecarThreadIdsForParent(
    apiClient,
    parentThreadId,
  );
  const results = await Promise.allSettled(
    sidecarIds.map((threadId) => deleteIdempotently(apiClient, threadId)),
  );
  const deletedThreadIds: string[] = [];
  const failedThreadIds: string[] = [];
  const causes: unknown[] = [];
  results.forEach((result, index) => {
    const threadId = sidecarIds[index]!;
    if (result.status === "fulfilled") deletedThreadIds.push(threadId);
    else {
      failedThreadIds.push(threadId);
      causes.push(result.reason);
    }
  });
  if (failedThreadIds.length > 0) {
    throw new ThreadCascadeDeleteError({
      parentThreadId,
      failedThreadIds,
      deletedThreadIds,
      causes,
    });
  }
  try {
    await deleteIdempotently(apiClient, parentThreadId);
  } catch (error) {
    throw new ThreadCascadeDeleteError({
      parentThreadId,
      failedThreadIds: [parentThreadId],
      deletedThreadIds,
      causes: [error],
    });
  }
  return [...deletedThreadIds, parentThreadId];
}
