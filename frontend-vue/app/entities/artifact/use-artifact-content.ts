import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import { loadArtifactContent } from "../../core/artifacts/loader";

export function useArtifactContent({
  enabled = true,
  filepath,
  threadId,
}: {
  enabled?: MaybeRefOrGetter<boolean>;
  filepath: MaybeRefOrGetter<string | null | undefined>;
  threadId: MaybeRefOrGetter<string>;
}) {
  const currentFilepath = computed(() => toValue(filepath) ?? null);
  const currentThreadId = computed(() => toValue(threadId));
  const query = useQuery({
    enabled: computed(() =>
      Boolean(toValue(enabled) && currentFilepath.value && currentThreadId.value),
    ),
    queryKey: computed(() => [
      "artifact-content",
      currentThreadId.value,
      currentFilepath.value,
    ]),
    queryFn: () => {
      const nextFilepath = currentFilepath.value;
      if (!nextFilepath) {
        throw new Error("未选择产物。");
      }
      return loadArtifactContent({
        filepath: nextFilepath,
        threadId: currentThreadId.value,
      });
    },
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 0,
  });

  const selectedData = computed(() => {
    const data = query.data.value;
    return data?.filepath === currentFilepath.value ? data : null;
  });

  return {
    content: computed(() => selectedData.value?.content ?? null),
    errorMessage: computed(() => query.error.value?.message ?? null),
    isLoading: computed(() => query.isFetching.value),
    query,
    url: computed(() => selectedData.value?.url ?? null),
  };
}
