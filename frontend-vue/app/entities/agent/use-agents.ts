import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, type MaybeRefOrGetter, toValue } from "vue";

import { listModels } from "../../core/api/models/client";
import {
  deleteAgent,
  listAgents,
  updateAgent,
} from "../../core/api/agents/client";
import type { UpdateAgentRequest } from "../../core/api/agents/types";

export function useAgentsEntity(enabled: MaybeRefOrGetter<boolean> = true) {
  const queryClient = useQueryClient();
  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: listAgents,
    enabled: computed(() => toValue(enabled)),
  });
  const modelsQuery = useQuery({
    queryKey: ["models"],
    queryFn: listModels,
    enabled: computed(() => toValue(enabled)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ name, request }: { name: string; request: UpdateAgentRequest }) =>
      updateAgent(name, request),
    onSuccess: (_agent, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
      void queryClient.invalidateQueries({ queryKey: ["agents", variables.name] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteAgent(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  return {
    agentsQuery,
    deleteAgent: deleteMutation.mutateAsync,
    deleteError: deleteMutation.error,
    isDeleting: deleteMutation.isPending,
    isUpdating: updateMutation.isPending,
    modelsQuery,
    updateAgent: updateMutation.mutateAsync,
    updateError: updateMutation.error,
  };
}

export type AgentsEntity = ReturnType<typeof useAgentsEntity>;
