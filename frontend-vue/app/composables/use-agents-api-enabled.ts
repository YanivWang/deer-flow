import { useQuery } from "@tanstack/vue-query";
import { computed, onMounted, ref, watch } from "vue";

const AGENTS_API_ENABLED_KEY = "deerflow.features.agents_api";

export function useAgentsApiEnabled(options: { enabled?: boolean } = {}) {
  const cached = ref<boolean | undefined>(readCachedAgentsApiEnabled());
  const query = useQuery({
    queryKey: ["features", "agents_api"],
    queryFn: fetchAgentsApiEnabled,
    refetchOnMount: true,
    retry: false,
    staleTime: 0,
    enabled: options.enabled ?? true,
  });

  onMounted(() => {
    cached.value = readCachedAgentsApiEnabled();
  });

  watch(query.data, (value) => {
    if (typeof value !== "boolean") {
      return;
    }
    cached.value = value;
    writeCachedAgentsApiEnabled(value);
  }, { immediate: true });

  return {
    enabled: computed(() => query.data.value ?? cached.value ?? true),
    isLoading: computed(
      () => (options.enabled ?? true) && query.isPending.value && cached.value === undefined,
    ),
  };
}

export function useBrowserControlEnabled() {
  const query = useQuery({
    queryKey: ["features", "browser_control"],
    queryFn: async () => {
      const response = await fetch("/api/features", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load features");
      }
      const payload = (await response.json()) as {
        browser_control?: { enabled?: unknown };
      };
      return payload.browser_control?.enabled === undefined
        ? true
        : payload.browser_control.enabled === true;
    },
    refetchOnMount: true,
    retry: false,
    staleTime: 0,
  });

  return {
    enabled: computed(() => query.data.value ?? true),
  };
}

async function fetchAgentsApiEnabled(): Promise<boolean> {
  const response = await fetch("/api/features", { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to load features: ${response.statusText}`);
  }
  const payload = (await response.json()) as { agents_api?: { enabled?: unknown } };
  return payload.agents_api?.enabled === undefined
    ? true
    : payload.agents_api.enabled === true;
}

function readCachedAgentsApiEnabled(): boolean | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    const value = window.localStorage.getItem(AGENTS_API_ENABLED_KEY);
    return value === "true" ? true : value === "false" ? false : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedAgentsApiEnabled(value: boolean): void {
  try {
    window.localStorage.setItem(AGENTS_API_ENABLED_KEY, String(value));
  } catch {
    return;
  }
}
