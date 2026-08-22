/*
  【文件职责】     作为 Memory document 与 CRUD/import mutations 的唯一 Vue Query owner。
  【对应 frontend/】 core/memory/hooks.ts
  【架构位置】     L3 Vue server-state adapter
  【主要导出】     useMemory
  【依赖关系】     @tanstack/vue-query · memory api/query key
  【边界与注意】   mutation 不乐观伪装成功；scope dispose 中止在途 I/O，完整 Gateway 响应原样进入同一缓存。
*/

import { onScopeDispose } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";

import {
  clearMemory,
  createMemoryFact,
  deleteMemoryFact,
  exportMemory,
  importMemory,
  loadMemory,
  updateMemoryFact,
} from "@/core/memory/api";
import { MEMORY_QUERY_KEY } from "@/core/memory/query-keys";
import type {
  MemoryFactInput,
  MemoryFactPatchInput,
  UserMemory,
} from "@/core/memory/types";

function useScopedRequests() {
  const controllers = new Set<AbortController>();
  async function run<T>(task: (signal: AbortSignal) => Promise<T>) {
    const controller = new AbortController();
    controllers.add(controller);
    try {
      const result = await task(controller.signal);
      if (controller.signal.aborted)
        throw new DOMException("Aborted", "AbortError");
      return result;
    } finally {
      controllers.delete(controller);
    }
  }
  onScopeDispose(() => {
    for (const controller of controllers) controller.abort();
    controllers.clear();
  });
  return run;
}

export function useMemory() {
  const queryClient = useQueryClient();
  const runScoped = useScopedRequests();
  const query = useQuery({
    queryKey: MEMORY_QUERY_KEY,
    queryFn: ({ signal }) => loadMemory({ signal }),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const sync = (next: UserMemory) => {
    queryClient.setQueryData(MEMORY_QUERY_KEY, next);
  };
  const clear = useMutation({
    mutationFn: () => runScoped((signal) => clearMemory({ signal })),
    onSuccess: sync,
  });
  const create = useMutation({
    mutationFn: (input: MemoryFactInput) =>
      runScoped((signal) => createMemoryFact(input, { signal })),
    onSuccess: sync,
  });
  const remove = useMutation({
    mutationFn: (factId: string) =>
      runScoped((signal) => deleteMemoryFact(factId, { signal })),
    onSuccess: sync,
  });
  const importDocument = useMutation({
    mutationFn: (input: UserMemory) =>
      runScoped((signal) => importMemory(input, { signal })),
    onSuccess: sync,
  });
  const exportDocument = useMutation({
    mutationFn: () => runScoped((signal) => exportMemory({ signal })),
  });
  const update = useMutation({
    mutationFn: ({
      factId,
      input,
    }: {
      factId: string;
      input: MemoryFactPatchInput;
    }) => runScoped((signal) => updateMemoryFact(factId, input, { signal })),
    onSuccess: sync,
  });
  return {
    memory: query.data,
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    clear,
    create,
    remove,
    importDocument,
    exportDocument,
    update,
  };
}
