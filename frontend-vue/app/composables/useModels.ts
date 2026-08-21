/*
  【文件职责】     以 Vue Query 持有完整 /api/models 服务端响应。
  【对应 frontend/】 core/models/hooks.ts
  【架构位置】     L3 Vue Query adapter
  【主要导出】     useModels · MODELS_QUERY_KEY
  【依赖关系】     core/models/api
  【边界与注意】   同时暴露 models 与 token_usage.enabled，禁止组件各自重复请求。
*/

import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";

import { loadModels } from "@/core/models/api";

export const MODELS_QUERY_KEY = ["models"] as const;

/** Single Vue Query owner for the complete /api/models response. */
export function useModels(
  options: {
    enabled?: MaybeRefOrGetter<boolean>;
  } = {},
) {
  const query = useQuery({
    queryKey: MODELS_QUERY_KEY,
    queryFn: loadModels,
    enabled: computed(() => toValue(options.enabled ?? true)),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  return {
    models: computed(() => query.data.value?.models ?? []),
    tokenUsageEnabled: computed(
      () => query.data.value?.token_usage.enabled ?? false,
    ),
    loading: query.isLoading,
    error: query.error,
  };
}
