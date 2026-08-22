/*
  【文件职责】     以 Vue Query 持有 composer 的 skills catalog 与 ready 状态。
  【对应 frontend/】 core/skills/hooks.ts
  【架构位置】     L3 Vue Query adapter
  【主要导出】     useSkillsCatalog · SKILLS_CATALOG_QUERY_KEY
  【依赖关系】     core/skills/api
  【边界与注意】   ready 区分“空 catalog”与“尚未加载”，供安全草稿恢复使用。
*/

import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";

import { loadSkills, SkillRequestError } from "@/core/skills/api";

export const SKILLS_QUERY_KEY = ["skills"] as const;

/** Composer-facing, server-state-backed enabled skill catalog. */
export function useSkillsCatalog(
  options: {
    enabled?: MaybeRefOrGetter<boolean>;
  } = {},
) {
  const query = useQuery({
    queryKey: SKILLS_QUERY_KEY,
    queryFn: ({ signal }) => loadSkills({ signal }),
    enabled: computed(() => toValue(options.enabled ?? true)),
    refetchOnWindowFocus: false,
    retry: (count, error) => !(error instanceof SkillRequestError) && count < 3,
  });

  return {
    skills: computed(() => query.data.value ?? []),
    ready: computed(() => query.isFetched.value || query.isError.value),
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
