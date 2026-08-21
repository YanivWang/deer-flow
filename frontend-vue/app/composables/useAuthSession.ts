/*
  【文件职责】     用 Vue Query 暴露单一 Gateway session 状态与不可用恢复探测。
  【对应 frontend/】 frontend/src/core/auth/AuthProvider.tsx · gateway-offline-banner.tsx
  【架构位置】     L3 composable
  【主要导出】     useAuthSession
  【依赖关系】     @tanstack/vue-query · core/auth/session-query
  【边界与注意】   unavailable 保留为服务状态，绝不能转换成 unauthenticated 或清理 cookie。
*/

import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";

import { authSessionQueryOptions } from "@/core/auth/session-query";

export const AUTH_SESSION_RETRY_INTERVAL_MS = 10_000;

export function useAuthSession(options: {
  enabled: MaybeRefOrGetter<boolean>;
}) {
  const enabled = computed(() => toValue(options.enabled));
  const query = useQuery({
    ...authSessionQueryOptions(),
    enabled,
    refetchInterval: (current) =>
      current.state.data?.tag === "unavailable"
        ? AUTH_SESSION_RETRY_INTERVAL_MS
        : false,
  });

  return {
    session: computed(() => query.data.value),
    isFetching: query.isFetching,
    refresh: query.refetch,
  };
}
