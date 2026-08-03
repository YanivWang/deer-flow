import { computed, ref } from "vue";

import { useChannelSettings } from "../../../features/settings/channels/use-channel-settings";
import type {
  ChannelProvider,
  ChannelRuntimeConfigValues,
} from "../../../core/api/channels/client";

type ChannelSettingsController = ReturnType<typeof useChannelSettings>;

export function useChatSidebarChannels(
  options: { channelSettings?: ChannelSettingsController } = {},
) {
  const channelSettings = options.channelSettings ?? useChannelSettings(true);
  const channelSetupProvider = ref<ChannelProvider | null>(null);
  const channelSetupValues = ref<ChannelRuntimeConfigValues>({});
  const channelActionMessage = ref("");
  const channelProviderSnapshots = ref<Record<string, ChannelProvider>>({});

  const visibleChannelProviders = computed(() =>
    channelSettings.providers.value.filter((provider) => provider.enabled),
  );

  function channelIsConnected(provider: ChannelProvider): boolean {
    return !provider.unavailable_reason && provider.connection_status === "connected";
  }

  function openChannelSetup(provider: ChannelProvider): void {
    const snapshot = channelProviderSnapshots.value[provider.provider];
    const effectiveProvider = snapshot && provider.credential_fields.length === 0
      ? {
          ...provider,
          credential_fields: snapshot.credential_fields,
          credential_values: snapshot.credential_values,
        }
      : provider;
    channelProviderSnapshots.value[provider.provider] = effectiveProvider;
    channelSetupProvider.value = effectiveProvider;
    channelSetupValues.value = Object.fromEntries(
      effectiveProvider.credential_fields.map((field) => [
        field.name,
        effectiveProvider.credential_values[field.name] ?? "",
      ]),
    );
  }

  function updateChannelSetupValue(fieldName: string, value: string): void {
    channelSetupValues.value = {
      ...channelSetupValues.value,
      [fieldName]: value,
    };
  }

  function cancelChannelSetup(): void {
    channelSetupProvider.value = null;
  }

  async function connectChannel(provider: ChannelProvider): Promise<void> {
    if (!provider.configured || channelIsConnected(provider)) {
      openChannelSetup(provider);
      return;
    }
    try {
      const result = await channelSettings.connectProvider(provider.provider);
      channelActionMessage.value = result.instruction;
    } catch (error) {
      channelActionMessage.value = error instanceof Error ? error.message : "无法连接频道。";
    }
  }

  async function saveChannelSetup(): Promise<void> {
    const provider = channelSetupProvider.value;
    if (!provider) return;
    const submittedValues = { ...channelSetupValues.value };
    try {
      const updated = await channelSettings.configureProvider({
        provider: provider.provider,
        values: submittedValues,
      });
      channelProviderSnapshots.value[provider.provider] = {
        ...provider,
        ...updated,
        credential_fields: updated.credential_fields.length > 0
          ? updated.credential_fields
          : provider.credential_fields,
        credential_values: Object.keys(updated.credential_values ?? {}).length > 0
          ? updated.credential_values
          : Object.fromEntries(Object.keys(submittedValues).map((key) => [key, "********"])),
      };
      channelSetupProvider.value = null;
      if (updated.connectable) {
        await connectChannel(updated);
      }
    } catch (error) {
      channelActionMessage.value = error instanceof Error ? error.message : "无法保存频道配置。";
    }
  }

  return {
    cancelChannelSetup,
    channelActionMessage,
    channelConnectionsEnabled: channelSettings.channelConnectionsEnabled,
    channelIsConnected,
    channelSetupProvider,
    channelSetupValues,
    connectChannel,
    isMutationPending: channelSettings.isMutationPending,
    saveChannelSetup,
    updateChannelSetupValue,
    visibleChannelProviders,
  };
}

export type ChatSidebarChannelsController = ReturnType<typeof useChatSidebarChannels>;
