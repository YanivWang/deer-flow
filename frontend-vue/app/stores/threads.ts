import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { getAPIClient } from "@/core/api/api-client";
import { patchThreadMetadata } from "@/core/threads/api";
import type { AgentThread } from "@/core/threads/types";
import {
  isThreadPinned,
  sortPinnedThreads,
  THREAD_PINNED_METADATA_KEY,
} from "@/core/threads/utils";

const PAGE_SIZE = 50;

export function mergeThreadSnapshot(
  existing: AgentThread | undefined,
  incoming: AgentThread,
): AgentThread {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    metadata: { ...existing.metadata, ...incoming.metadata },
    values: { ...existing.values, ...incoming.values },
  };
}

export const useThreadsStore = defineStore("threads", () => {
  const threads = ref<AgentThread[]>([]);
  const offset = ref(0);
  const hasMore = ref(true);
  const loading = ref(false);
  const loaded = ref(false);

  const displayedThreads = computed(() => sortPinnedThreads(threads.value));

  function merge(items: AgentThread[]) {
    const byId = new Map(
      threads.value.map((thread) => [thread.thread_id, thread]),
    );
    for (const thread of items) {
      byId.set(
        thread.thread_id,
        mergeThreadSnapshot(byId.get(thread.thread_id), thread),
      );
    }
    threads.value = [...byId.values()];
  }

  async function loadInitial(force = false) {
    if ((loaded.value && !force) || loading.value) return;
    if (force) {
      threads.value = [];
      offset.value = 0;
      hasMore.value = true;
    }
    loaded.value = true;
    await loadMore();
  }

  async function loadMore() {
    if (loading.value || !hasMore.value) return;
    loading.value = true;
    try {
      const page = await getAPIClient().threads.search({
        limit: PAGE_SIZE,
        offset: offset.value,
        sortBy: "updated_at",
        sortOrder: "desc",
        select: ["thread_id", "updated_at", "values", "metadata", "status"],
      });
      merge(page);
      offset.value += page.length;
      hasMore.value = page.length === PAGE_SIZE;
    } finally {
      loading.value = false;
    }
  }

  function upsert(thread: AgentThread) {
    merge([thread]);
  }

  function upsertCreated(threadId: string, agentName?: string | null) {
    const now = new Date().toISOString();
    upsert({
      thread_id: threadId,
      created_at: now,
      updated_at: now,
      metadata: agentName ? { agent_name: agentName } : {},
      status: "idle",
      values: { title: "New Chat", messages: [] },
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
    threads.value = threads.value.map((thread) =>
      thread.thread_id === threadId
        ? {
            ...thread,
            metadata: {
              ...thread.metadata,
              [THREAD_PINNED_METADATA_KEY]: pinned,
            },
          }
        : thread,
    );
  }

  async function remove(threadId: string) {
    await getAPIClient().threads.delete(threadId);
    threads.value = threads.value.filter(
      (thread) => thread.thread_id !== threadId,
    );
  }

  async function rename(threadId: string, title: string) {
    await getAPIClient().threads.updateState(threadId, { values: { title } });
    threads.value = threads.value.map((thread) =>
      thread.thread_id === threadId
        ? { ...thread, values: { ...thread.values, title } }
        : thread,
    );
  }

  return {
    threads,
    displayedThreads,
    hasMore,
    loading,
    loadInitial,
    loadMore,
    upsert,
    upsertCreated,
    setPinned,
    remove,
    rename,
    isPinned: isThreadPinned,
  };
});
