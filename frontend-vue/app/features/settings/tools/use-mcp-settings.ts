import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import {
  loadMcpConfig,
  McpConfigRequestError,
  resetMcpToolsCache,
  updateMcpConfig,
  updateMcpServerState,
  type McpConfig,
  type McpCacheResetResponse,
} from "../../../core/api/mcp/client";

export const MCP_CONFIG_QUERY_KEY = ["mcpConfig"] as const;

export function useMcpSettings(enabled: MaybeRefOrGetter<boolean> = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: computed(() => toValue(enabled)),
    queryFn: () => loadMcpConfig(),
    queryKey: MCP_CONFIG_QUERY_KEY,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) =>
      !(error instanceof McpConfigRequestError) && failureCount < 3,
  });

  const setEnabledMutation = useMutation({
    mutationFn: ({ enabled, serverName }: { enabled: boolean; serverName: string }) =>
      updateMcpServerState(serverName, enabled),
    onSuccess: (config) => {
      queryClient.setQueryData<McpConfig>(MCP_CONFIG_QUERY_KEY, config);
    },
  });
  const updateConfigMutation = useMutation({
    mutationFn: (config: McpConfig) => updateMcpConfig(config),
    onSuccess: (config) => {
      queryClient.setQueryData<McpConfig>(MCP_CONFIG_QUERY_KEY, config);
    },
  });
  const resetCacheMutation = useMutation({
    mutationFn: () => resetMcpToolsCache(),
  });

  const serverEntries = computed(() =>
    Object.entries(query.data.value?.mcp_servers ?? {}).map(([name, config]) => ({
      config,
      name,
    })),
  );
  const errorMessage = computed(() =>
    query.error.value instanceof Error ? query.error.value.message : "",
  );
  const adminRequired = computed(
    () => query.error.value instanceof McpConfigRequestError && query.error.value.isAdminRequired,
  );

  return {
    adminRequired,
    config: computed(() => query.data.value ?? null),
    errorMessage,
    isMutationPending: computed(
      () =>
        setEnabledMutation.isPending.value ||
        updateConfigMutation.isPending.value ||
        resetCacheMutation.isPending.value,
    ),
    mutationErrorMessage: computed(
      () =>
        setEnabledMutation.error.value?.message ??
        updateConfigMutation.error.value?.message ??
        resetCacheMutation.error.value?.message ??
        "",
    ),
    query,
    resetCache: resetCacheMutation.mutateAsync as () => Promise<McpCacheResetResponse>,
    serverEntries,
    saveConfig: updateConfigMutation.mutateAsync,
    setServerEnabled: setEnabledMutation.mutateAsync,
  };
}
