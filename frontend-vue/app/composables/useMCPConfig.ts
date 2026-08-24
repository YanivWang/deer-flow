/*
  【文件职责】     作为 admin-only MCP config query 与 PATCH mutation 的唯一 Vue Query owner。
  【架构位置】     L3 Vue server-state adapter
  【主要导出】     useMCPConfig
  【依赖关系】     @tanstack/vue-query · MCP api/query key
  【边界与注意】   known non-admin 不发 GET/PATCH；成功响应同步后等待真实 re-read，403 不自动 retry。
*/

import { computed, onScopeDispose, toValue, type MaybeRefOrGetter } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";

import {
  loadMCPConfig,
  MCPConfigRequestError,
  updateMCPServerState,
} from "@/core/mcp/api";
import { MCP_CONFIG_QUERY_KEY } from "@/core/mcp/query-keys";
import type { MCPConfig } from "@/core/mcp/types";
import { SettingsPermissionError } from "@/core/settings/permissions";

export function useMCPConfig(options: { enabled: MaybeRefOrGetter<boolean> }) {
  const queryClient = useQueryClient();
  const enabled = computed(() => Boolean(toValue(options.enabled)));
  const query = useQuery({
    queryKey: MCP_CONFIG_QUERY_KEY,
    enabled,
    queryFn: ({ signal }) => loadMCPConfig({ signal }),
    refetchOnWindowFocus: false,
    retry: (count, error) =>
      !(error instanceof MCPConfigRequestError) && count < 3,
  });
  const mutation = useMutation({
    mutationFn: ({
      serverName,
      nextEnabled,
      signal,
    }: {
      serverName: string;
      nextEnabled: boolean;
      signal: AbortSignal;
    }) => updateMCPServerState(serverName, nextEnabled, { signal }),
    onSuccess: async (config) => {
      queryClient.setQueryData(MCP_CONFIG_QUERY_KEY, config);
      await queryClient.invalidateQueries({
        queryKey: MCP_CONFIG_QUERY_KEY,
        exact: true,
      });
    },
  });
  let inFlight: Promise<MCPConfig> | null = null;
  let controller: AbortController | null = null;
  async function toggle(serverName: string, nextEnabled: boolean) {
    if (!enabled.value) throw new SettingsPermissionError();
    if (inFlight) return inFlight;
    controller = new AbortController();
    inFlight = mutation
      .mutateAsync({ serverName, nextEnabled, signal: controller.signal })
      .finally(() => {
        inFlight = null;
        controller = null;
      });
    return inFlight;
  }
  onScopeDispose(() => controller?.abort());
  return {
    config: query.data,
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    toggle,
    pending: mutation.isPending,
    mutationError: mutation.error,
  };
}
