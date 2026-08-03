<script setup lang="ts">
import type { SettingsChannelsController } from "../../../features/settings/channels/use-settings-channels";
import {
  channelConnectionLabel,
  channelProviderDescription,
  channelStatusLabel,
} from "../../../features/settings/channels/use-settings-channels";
import AppDialog from "../../../shared/ui/AppDialog.vue";

const props = defineProps<{
  channels: SettingsChannelsController;
  configDialogOpen: boolean;
  translate: (key: string) => string;
}>();

const emit = defineEmits<{
  "close-config": [];
  "open-config": [];
}>();

function eventTargetValue(event: Event): string {
  return event.target instanceof HTMLInputElement ? event.target.value : "";
}

async function connectProvider(provider: Parameters<SettingsChannelsController["connectChannel"]>[0]) {
  const requiresConfig = props.channels.providerNeedsRuntimeConfig(provider);
  await props.channels.connectChannel(provider);
  if (requiresConfig) {
    emit("open-config");
  }
}
</script>

<template>
  <h2>渠道</h2>
  <p data-testid="vue-settings-channels-anchor">
    IM 渠道连接使用 Gateway `/api/channels/*` provider 和运行时配置契约。
  </p>
  <p v-if="props.channels.isLoading.value" data-testid="vue-settings-channels-loading">
    正在加载渠道...
  </p>
  <p
    v-else-if="props.channels.errorMessage.value"
    class="workspace-error"
    data-testid="vue-settings-channels-error"
  >
    {{ props.channels.errorMessage.value }}
  </p>
  <p
    v-else-if="!props.channels.channelConnectionsEnabled.value"
    class="workspace-notice"
    data-testid="vue-settings-channels-disabled"
  >
    Gateway 配置已禁用渠道连接。
  </p>
  <template v-else>
    <a-empty
      v-if="props.channels.channelProviderEntries.value.length === 0"
      description="暂无已启用的渠道 provider"
      data-testid="vue-settings-channels-empty"
    />
    <ul v-else class="settings-channels-list" data-testid="vue-settings-channels-list">
      <li
        v-for="provider in props.channels.channelProviderEntries.value"
        :key="provider.provider"
        class="settings-channel-provider"
        :data-testid="`vue-settings-channel-${provider.provider}`"
      >
        <div class="settings-channel-provider__body">
          <strong>{{ provider.display_name }}</strong>
          <p>{{ channelProviderDescription(provider) }}</p>
          <p>
            {{ channelStatusLabel(provider, props.channels.connectionForProvider(provider)) }}
            <template v-if="channelConnectionLabel(props.channels.connectionForProvider(provider))">
              · {{ channelConnectionLabel(props.channels.connectionForProvider(provider)) }}
            </template>
          </p>
          <small v-if="provider.unavailable_reason">{{ provider.unavailable_reason }}</small>
          <dl class="settings-channel-provider__details">
            <dt>认证模式</dt>
            <dd>{{ provider.auth_mode }}</dd>
            <dt>凭据字段</dt>
            <dd>{{ provider.credential_fields.map((field) => field.label).join(", ") || "-" }}</dd>
            <dt>可连接</dt>
            <dd>{{ provider.connectable ? "是" : "否" }}</dd>
          </dl>
        </div>
        <div class="settings-channel-provider__actions">
          <button
            v-if="props.channels.providerCanEditRuntimeConfig(provider)"
            class="workspace-button"
            :data-testid="`vue-settings-channel-config-${provider.provider}`"
            :disabled="props.channels.isMutationPending.value"
            type="button"
            @click="props.channels.startChannelRuntimeConfig(provider); emit('open-config')"
          >
            {{ props.translate("channels.modify") }}
          </button>
          <button
            class="workspace-button workspace-button--primary"
            :data-testid="`vue-settings-channel-connect-${provider.provider}`"
            :disabled="props.channels.isMutationPending.value || (!provider.connectable && !props.channels.providerNeedsRuntimeConfig(provider))"
            type="button"
            @click="connectProvider(provider)"
          >
            连接
          </button>
          <button
            v-if="provider.configured"
            class="workspace-button"
            :data-testid="`vue-settings-channel-disconnect-${provider.provider}`"
            :disabled="props.channels.isMutationPending.value"
            type="button"
            @click="props.channels.disconnectChannel(provider)"
          >
            断开 provider
          </button>
          <button
            v-if="props.channels.connectionForProvider(provider)"
            class="workspace-button"
            :data-testid="`vue-settings-channel-revoke-${provider.provider}`"
            :disabled="props.channels.isMutationPending.value"
            type="button"
            @click="props.channels.revokeProviderConnection(provider)"
          >
            撤销连接
          </button>
        </div>
      </li>
    </ul>
    <AppDialog
      :open="props.configDialogOpen && Boolean(props.channels.channelConfigProvider.value)"
      :title="`${props.channels.channelConfigProvider.value?.display_name ?? ''} 运行时配置`"
      @close="emit('close-config')"
    >
      <form
        class="settings-channel-config"
        data-testid="vue-settings-channel-config-form"
        @submit.prevent="props.channels.submitChannelRuntimeConfig"
      >
        <template v-if="props.channels.channelConfigProvider.value">
          <label
            v-for="field in props.channels.channelConfigProvider.value.credential_fields"
            :key="field.name"
            class="workspace-field"
          >
            <span>{{ field.label }}</span>
            <input
              :data-testid="`vue-settings-channel-config-field-${field.name}`"
              :type="field.type === 'password' ? 'password' : 'text'"
              :value="props.channels.channelConfigValues.value[field.name] ?? ''"
              @input="props.channels.setChannelConfigValue(field.name, eventTargetValue($event))"
            >
          </label>
        </template>
        <button
          class="workspace-button workspace-button--primary"
          data-testid="vue-settings-channel-config-submit"
          :disabled="props.channels.isMutationPending.value"
          type="submit"
        >
          保存运行时配置
        </button>
      </form>
    </AppDialog>
    <p
      v-if="props.channels.channelActionMessage.value"
      class="settings-success"
      data-testid="vue-settings-channels-action-message"
    >
      {{ props.channels.channelActionMessage.value }}
    </p>
    <p
      v-if="props.channels.channelConnectUrl.value"
      class="workspace-notice"
      data-testid="vue-settings-channels-connect-url"
    >
      {{ props.channels.channelConnectUrl.value }}
    </p>
    <p
      v-if="props.channels.mutationErrorMessage.value"
      class="workspace-error"
      data-testid="vue-settings-channels-mutation-error"
    >
      {{ props.channels.mutationErrorMessage.value }}
    </p>
  </template>
</template>
