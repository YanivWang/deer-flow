import { readonly, ref } from "vue";

import {
  listChannelConnections,
  listChannelProviders,
} from "@/core/channels/api";
import type { ChannelConnection, ChannelProvider } from "@/core/channels/types";

const providers = ref<ChannelProvider[]>([]);
const connections = ref<ChannelConnection[]>([]);
const enabled = ref(false);
const loading = ref(false);
const loaded = ref(false);
const error = ref<string | null>(null);

export function useChannels() {
  async function refresh() {
    if (loading.value) return;
    loading.value = true;
    error.value = null;
    try {
      const [providerData, connectionData] = await Promise.all([
        listChannelProviders(),
        listChannelConnections(),
      ]);
      enabled.value = providerData.enabled;
      providers.value = providerData.providers.filter((item) => item.enabled);
      connections.value = connectionData;
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : "Failed to load channels";
      providers.value = [];
      connections.value = [];
      enabled.value = false;
    } finally {
      loaded.value = true;
      loading.value = false;
    }
  }

  function replaceProvider(next: ChannelProvider) {
    const index = providers.value.findIndex(
      (item) => item.provider === next.provider,
    );
    if (index >= 0) providers.value.splice(index, 1, next);
    else if (next.enabled) providers.value.push(next);
  }

  return {
    providers,
    connections,
    enabled: readonly(enabled),
    loaded: readonly(loaded),
    loading: readonly(loading),
    error: readonly(error),
    refresh,
    replaceProvider,
  };
}
