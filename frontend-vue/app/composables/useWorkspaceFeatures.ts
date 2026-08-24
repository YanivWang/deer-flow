/*
  【文件职责】     加载 Gateway feature flags 并提供 fail-closed 只读状态。
  【架构位置】     L3 Vue adapter
  【主要导出】     useWorkspaceFeatures
  【依赖关系】     core/features API · Vue lifecycle
  【边界与注意】   失败时隐藏专有功能；不进入 L2。
*/

import { onMounted, readonly, ref } from "vue";

import {
  readCachedAgentsApiEnabled,
  resolveAgentsApiEnabled,
  writeCachedAgentsApiEnabled,
} from "@/core/agents/feature-cache";
import { fetchFeatures } from "@/core/features/api";

const loaded = ref(false);
const loading = ref(false);
const agentsApiEnabled = ref(true);
const browserControlEnabled = ref(false);

async function refreshFeatures() {
  if (loading.value) return;
  loading.value = true;
  const cached = readCachedAgentsApiEnabled();
  try {
    const features = await fetchFeatures();
    agentsApiEnabled.value = features.agents_api.enabled;
    browserControlEnabled.value = features.browser_control?.enabled ?? false;
    writeCachedAgentsApiEnabled(features.agents_api.enabled);
  } catch {
    agentsApiEnabled.value = resolveAgentsApiEnabled(undefined, cached);
    browserControlEnabled.value = false;
  } finally {
    loaded.value = true;
    loading.value = false;
  }
}

export function useWorkspaceFeatures(options: { enabled?: boolean } = {}) {
  onMounted(() => {
    if (options.enabled !== false) void refreshFeatures();
  });
  return {
    loaded: readonly(loaded),
    agentsApiEnabled: readonly(agentsApiEnabled),
    browserControlEnabled: readonly(browserControlEnabled),
    refreshFeatures,
  };
}
