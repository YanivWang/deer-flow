import type { AgentThread } from "./types";
import { isThreadPinned, sortPinnedThreads } from "./utils";

const MAX_VISIBLE_THREADS = 200;
const modelCache = new WeakMap<object, ThreadListModel>();

export type ThreadListModel = {
  byId: ReadonlyMap<string, AgentThread>;
  threads: readonly AgentThread[];
  displayedThreads: readonly AgentThread[];
  canLoadMore: boolean;
};

export function buildThreadListModel(
  pages: readonly (readonly AgentThread[])[],
): ThreadListModel {
  const cacheKey = pages as object;
  const cached = modelCache.get(cacheKey);
  if (cached) return cached;

  const byId = new Map<string, AgentThread>();
  for (const page of pages) {
    for (const thread of page) {
      if (!byId.has(thread.thread_id)) {
        byId.set(thread.thread_id, thread);
      }
    }
  }
  const model: ThreadListModel = {
    byId,
    ...buildThreadListView([...byId.values()]),
  };
  modelCache.set(cacheKey, model);
  return model;
}

/**
 * 去重之后的那一半：排序、侧栏可见上限、还能不能再翻一页。
 *
 * 拆出来是因为 Vue 的 useThreads 用的是**同一份**规则但不同的去重方式——它跨页
 * 合并同一个 thread 的快照（mergeThreadSnapshot），而这里按 React 的做法保留第一次
 * 出现的那份。把排序与上限抄第二遍的话，两处迟早只改一处：侧栏还能不能出现
 * 「加载更早的对话」这颗按钮，就取决于恰好走的是哪一条路。
 */
export function buildThreadListView(
  threads: readonly AgentThread[],
): Omit<ThreadListModel, "byId"> {
  const sortedThreads = sortPinnedThreads([...threads]);
  const pinnedThreads = sortedThreads.filter(isThreadPinned);
  const recentThreads = sortedThreads
    .filter((thread) => !isThreadPinned(thread))
    .slice(0, MAX_VISIBLE_THREADS);
  return {
    threads: sortedThreads,
    displayedThreads: [...pinnedThreads, ...recentThreads],
    canLoadMore: recentThreads.length < MAX_VISIBLE_THREADS,
  };
}
