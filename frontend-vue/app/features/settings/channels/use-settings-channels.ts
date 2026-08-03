import { computed, ref, type MaybeRefOrGetter } from "vue";

import type {
  ChannelConnection,
  ChannelProvider,
  ChannelRuntimeConfigValues,
} from "../../../core/api/channels/client";
import { useChannelSettings } from "./use-channel-settings";

export function useSettingsChannels(enabled: MaybeRefOrGetter<boolean> = true) {
  const channelSettings = useChannelSettings(enabled);
  const channelActionMessage = ref("");
  const channelConnectUrl = ref("");
  const channelConfigProvider = ref<ChannelProvider | null>(null);
  const channelConfigValues = ref<ChannelRuntimeConfigValues>({});
  const channelProviderEntries = computed(() =>
    channelSettings.providers.value.filter((provider) => provider.enabled),
  );
  const channelConnectionByProvider = computed(() =>
    buildChannelConnectionByProvider(channelSettings.connections.value),
  );
  const hasUnsavedChanges = computed(() => {
    const provider = channelConfigProvider.value;
    if (!provider) return false;
    return provider.credential_fields.some((field) =>
      (channelConfigValues.value[field.name] ?? "") !== (provider.credential_values[field.name] ?? ""),
    );
  });

  async function connectChannel(provider: ChannelProvider) {
    channelActionMessage.value = "";
    channelConnectUrl.value = "";
    if (providerNeedsRuntimeConfig(provider)) {
      startChannelRuntimeConfig(provider);
      return;
    }
    const result = await channelSettings.connectProvider(provider.provider);
    channelActionMessage.value = result.instruction;
    channelConnectUrl.value = result.url ?? "";
  }

  function startChannelRuntimeConfig(provider: ChannelProvider) {
    channelActionMessage.value = "";
    channelConnectUrl.value = "";
    channelConfigProvider.value = provider;
    channelConfigValues.value = Object.fromEntries(
      provider.credential_fields.map((field) => [
        field.name,
        provider.credential_values[field.name] ?? "",
      ]),
    );
  }

  function setChannelConfigValue(fieldName: string, value: string) {
    channelConfigValues.value = {
      ...channelConfigValues.value,
      [fieldName]: value,
    };
  }

  function resetChannelRuntimeConfig() {
    channelConfigProvider.value = null;
    channelConfigValues.value = {};
  }

  async function submitChannelRuntimeConfig() {
    const provider = channelConfigProvider.value;
    if (!provider) {
      return;
    }
    const updated = await channelSettings.configureProvider({
      provider: provider.provider,
      values: channelConfigValues.value,
    });
    channelConfigProvider.value = updated;
    channelActionMessage.value = `${updated.display_name} 运行时配置已保存。`;
  }

  async function disconnectChannel(provider: ChannelProvider) {
    const updated = await channelSettings.disconnectProvider(provider.provider);
    channelActionMessage.value = `${updated.display_name} 已断开连接。`;
    if (channelConfigProvider.value?.provider === provider.provider) {
      channelConfigProvider.value = updated;
    }
  }

  async function revokeChannelConnection(connectionId: string) {
    await channelSettings.disconnectConnection(connectionId);
    channelActionMessage.value = "渠道连接已撤销。";
  }

  async function revokeProviderConnection(provider: ChannelProvider) {
    const connection = connectionForProvider(provider);
    if (connection) {
      await revokeChannelConnection(connection.id);
    }
  }

  function connectionForProvider(provider: ChannelProvider) {
    return channelConnectionByProvider.value.get(provider.provider);
  }

  return {
    ...channelSettings,
    channelActionMessage,
    channelConfigProvider,
    channelConfigValues,
    channelConnectUrl,
    channelProviderEntries,
    hasUnsavedChanges,
    connectChannel,
    connectionForProvider,
    disconnectChannel,
    providerCanEditRuntimeConfig,
    providerNeedsRuntimeConfig,
    revokeProviderConnection,
    resetChannelRuntimeConfig,
    setChannelConfigValue,
    startChannelRuntimeConfig,
    submitChannelRuntimeConfig,
  };
}

export type SettingsChannelsController = ReturnType<typeof useSettingsChannels>;

function buildChannelConnectionByProvider(connections: ChannelConnection[]) {
  const byProvider = new Map<string, ChannelConnection>();
  for (const connection of connections) {
    const existing = byProvider.get(connection.provider);
    if (!existing || connection.status === "connected") {
      byProvider.set(connection.provider, connection);
    }
  }
  return byProvider;
}

export function channelConnectionLabel(connection: ChannelConnection | undefined): string {
  if (!connection) {
    return "";
  }
  if (connection.external_account_name && connection.workspace_name) {
    return `${connection.external_account_name} · ${connection.workspace_name}`;
  }
  return (
    connection.external_account_name ??
    connection.workspace_name ??
    connection.external_account_id ??
    ""
  );
}

export function channelStatusLabel(
  provider: ChannelProvider,
  connection: ChannelConnection | undefined,
): string {
  if (!provider.enabled) {
    return "已禁用";
  }
  if (!provider.configured) {
    return "未配置";
  }
  if (provider.unavailable_reason) {
    return "不可用";
  }
  return connection?.status ?? provider.connection_status;
}

export function channelProviderDescription(provider: ChannelProvider): string {
  const descriptions: Record<string, string> = {
    dingtalk: "DingTalk Stream Push messages through your DeerFlow bot.",
    discord: "Discord server messages through your DeerFlow bot.",
    feishu: "Feishu and Lark messages through your DeerFlow app.",
    slack: "Slack workspace messages and mentions.",
    telegram: "Telegram direct messages through your DeerFlow bot.",
    wechat: "WeChat iLink messages through your DeerFlow bot.",
    wecom: "WeCom messages through your DeerFlow AI bot.",
  };
  return descriptions[provider.provider] ?? provider.display_name;
}

function providerNeedsRuntimeConfig(provider: ChannelProvider): boolean {
  return provider.enabled && !provider.configured && provider.credential_fields.length > 0;
}

function providerCanEditRuntimeConfig(provider: ChannelProvider): boolean {
  return provider.enabled && provider.credential_fields.length > 0;
}
