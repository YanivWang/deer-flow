import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import {
  createMemoryFact,
  clearMemory,
  deleteMemoryFact,
  exportMemory,
  importMemory,
  loadMemory,
  updateMemoryFact,
  type MemoryFactInput,
  type MemoryFactPatchInput,
  type UserMemory,
} from "../core/api/memory/client";

export const MEMORY_QUERY_KEY = ["memory"] as const;

export function useMemorySettings(enabled: MaybeRefOrGetter<boolean> = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: computed(() => toValue(enabled)),
    queryKey: MEMORY_QUERY_KEY,
    queryFn: () => loadMemory(),
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: (input: MemoryFactInput) => createMemoryFact(input),
    onSuccess: (memory) => setMemoryQueryData(queryClient, memory),
  });
  const updateMutation = useMutation({
    mutationFn: ({ factId, input }: { factId: string; input: MemoryFactPatchInput }) =>
      updateMemoryFact(factId, input),
    onSuccess: (memory) => setMemoryQueryData(queryClient, memory),
  });
  const deleteMutation = useMutation({
    mutationFn: (factId: string) => deleteMemoryFact(factId),
    onSuccess: (memory) => setMemoryQueryData(queryClient, memory),
  });
  const clearMutation = useMutation({
    mutationFn: () => clearMemory(),
    onSuccess: (memory) => setMemoryQueryData(queryClient, memory),
  });
  const exportMutation = useMutation({
    mutationFn: () => exportMemory(),
    onSuccess: (memory) => setMemoryQueryData(queryClient, memory),
  });
  const importMutation = useMutation({
    mutationFn: (memory: UserMemory) => importMemory(memory),
    onSuccess: (memory) => setMemoryQueryData(queryClient, memory),
  });

  const mutationErrorMessage = computed(
    () =>
      createMutation.error.value?.message ??
      updateMutation.error.value?.message ??
      deleteMutation.error.value?.message ??
      clearMutation.error.value?.message ??
      exportMutation.error.value?.message ??
      importMutation.error.value?.message ??
      null,
  );

  return {
    clearAllMemory: clearMutation.mutateAsync,
    createFact: createMutation.mutateAsync,
    deleteFact: deleteMutation.mutateAsync,
    exportAllMemory: exportMutation.mutateAsync,
    facts: computed(() => query.data.value?.facts ?? []),
    importAllMemory: importMutation.mutateAsync,
    isMutationPending: computed(
      () =>
        createMutation.isPending.value ||
        updateMutation.isPending.value ||
        deleteMutation.isPending.value ||
        clearMutation.isPending.value ||
        exportMutation.isPending.value ||
        importMutation.isPending.value,
    ),
    memory: computed(() => query.data.value ?? null),
    mutationErrorMessage,
    query,
    updateFact: updateMutation.mutateAsync,
  };
}

function setMemoryQueryData(
  queryClient: ReturnType<typeof useQueryClient>,
  memory: UserMemory,
) {
  queryClient.setQueryData<UserMemory>(MEMORY_QUERY_KEY, memory);
}
