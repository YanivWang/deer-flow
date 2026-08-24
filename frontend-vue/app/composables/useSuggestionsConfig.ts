/*
  【文件职责】     统一持有 follow-up suggestions 的服务端配置查询。
  【架构位置】     L3 Vue Query adapter
  【主要导出】     useSuggestionsConfig
  【依赖关系】     @tanstack/vue-query · core/suggestions/api
  【边界与注意】   配置为全局稳定服务端状态；不得在组件 onMounted 中复制第二份缓存。
*/
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";

import { loadSuggestionsConfig } from "@/core/suggestions/api";

export function useSuggestionsConfig(options?: {
  enabled?: MaybeRefOrGetter<boolean>;
}) {
  return useQuery({
    queryKey: ["suggestionsConfig"],
    queryFn: loadSuggestionsConfig,
    staleTime: Infinity,
    enabled: computed(
      () => options?.enabled === undefined || toValue(options.enabled),
    ),
  });
}
