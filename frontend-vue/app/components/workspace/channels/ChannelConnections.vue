<script setup lang="ts">
/*
  【文件职责】     展示用户 channel instances，并编排连接、配置、单连接与管理员 provider 删除。
  【对应 frontend/】 src/components/workspace/channels/* · settings/channels-settings-page.tsx
  【架构位置】     L3 product UI
  【主要导出】     默认 ChannelConnections 组件
  【依赖关系】     useChannelConnections · auth session · channels helpers
  【边界与注意】   connections 是状态真相；provider 删除是全局管理员动作，不能伪装成用户断开。
*/

import { computed, ref } from "vue";

import ChannelProviderIcon from "./ChannelProviderIcon.vue";
import { useAuthSession } from "@/composables/useAuthSession";
import { useChannelConnections } from "@/composables/useChannelConnections";
import {
  AUTH_DISABLED_USER,
  isAuthDisabledMode,
} from "@/core/auth/auth-disabled-user";
import {
  closeConnectWindow,
  openConnectUrl,
  prepareConnectWindow,
  type ChannelConnectWindow,
} from "@/core/channels/open-connect-url";
import {
  providerCanEditRuntimeConfig,
  providerNeedsRuntimeConfig,
  providerSupportsConnect,
} from "@/core/channels/provider-state";
import {
  getChannelConnectionLabel,
  type ChannelProviderView,
} from "@/core/channels/state";
import type {
  ChannelConnection,
  ChannelProvider,
  ChannelProviderId,
  ChannelRuntimeConfigValues,
} from "@/core/channels/types";

withDefaults(defineProps<{ variant?: "sidebar" | "settings" }>(), {
  variant: "sidebar",
});

const { $i18n } = useNuxtApp();
const text = computed(() => $i18n.t.value.channels);
const authDisabled = isAuthDisabledMode();
const auth = useAuthSession({ enabled: computed(() => !authDisabled) });
const scopeKey = computed(() => {
  if (authDisabled) return AUTH_DISABLED_USER.id;
  const session = auth.session.value;
  return session?.tag === "authenticated" ? session.user.id : "";
});
const isAdmin = computed(() => {
  if (authDisabled) return AUTH_DISABLED_USER.system_role === "admin";
  const session = auth.session.value;
  return (
    session?.tag === "authenticated" && session.user.system_role === "admin"
  );
});
const channels = useChannelConnections({
  scopeKey,
  enabled: computed(() => Boolean(scopeKey.value)),
});

const editing = ref<ChannelProvider | null>(null);
const values = ref<ChannelRuntimeConfigValues>({});
const actionError = ref<string | null>(null);
const activeConnectProvider = ref<ChannelProviderId | null>(null);
const removingProvider = ref<ChannelProvider | null>(null);

const activeFlow = computed(() => {
  const provider = activeConnectProvider.value;
  return provider ? channels.connectFlows.value[provider] : undefined;
});

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function statusLabel(status: string) {
  const labels = text.value;
  if (status === "connected") return labels.connected;
  if (status === "pending") return labels.pending;
  if (status === "revoked") return labels.revoked;
  if (status === "not_connected") return labels.notConnected;
  return status.replaceAll("_", " ");
}

function beginSetup(provider: ChannelProvider) {
  editing.value = provider;
  values.value = { ...(provider.credential_values ?? {}) };
  actionError.value = null;
}

function prepareWindow(provider: ChannelProvider): ChannelConnectWindow {
  return provider.auth_mode === "deep_link" ? prepareConnectWindow() : null;
}

async function connectProvider(
  provider: ChannelProvider,
  connectWindow: ChannelConnectWindow = prepareWindow(provider),
) {
  actionError.value = null;
  if (providerNeedsRuntimeConfig(provider)) {
    closeConnectWindow(connectWindow);
    beginSetup(provider);
    return;
  }
  if (!providerSupportsConnect(provider)) {
    closeConnectWindow(connectWindow);
    actionError.value = provider.unavailable_reason || text.value.unavailable;
    return;
  }
  try {
    const response = await channels.connect(provider.provider);
    activeConnectProvider.value = provider.provider;
    if (response.url) openConnectUrl(response.url, connectWindow);
    else closeConnectWindow(connectWindow);
  } catch (cause) {
    closeConnectWindow(connectWindow);
    actionError.value = errorMessage(cause, text.value.unavailable);
  }
}

async function saveRuntimeConfig() {
  const provider = editing.value;
  if (!provider || channels.isProviderPending(provider.provider)) return;
  const hasActiveConnection = channels.connections.value.some(
    (connection) =>
      connection.provider === provider.provider &&
      (connection.status === "connected" || connection.status === "pending"),
  );
  const connectWindow = hasActiveConnection ? null : prepareWindow(provider);
  actionError.value = null;
  try {
    const next = await channels.configure(provider.provider, values.value);
    editing.value = null;
    if (!hasActiveConnection) await connectProvider(next, connectWindow);
    else closeConnectWindow(connectWindow);
  } catch (cause) {
    closeConnectWindow(connectWindow);
    actionError.value = errorMessage(cause, text.value.unavailable);
  }
}

async function disconnectConnection(connection: ChannelConnection) {
  actionError.value = null;
  try {
    await channels.disconnectConnection(connection.id);
  } catch (cause) {
    actionError.value = errorMessage(cause, text.value.unavailable);
  }
}

async function confirmProviderRemoval() {
  const provider = removingProvider.value;
  if (!provider) return;
  actionError.value = null;
  try {
    await channels.disconnectProvider(provider.provider);
    removingProvider.value = null;
  } catch (cause) {
    actionError.value = errorMessage(cause, text.value.unavailable);
  }
}

function closeConnectDialog() {
  const provider = activeConnectProvider.value;
  if (provider && activeFlow.value?.status === "waiting") {
    channels.cancelConnect(provider);
  }
  activeConnectProvider.value = null;
}

function connectLabel(view: ChannelProviderView) {
  return view.connections.some(
    (connection) =>
      connection.status === "connected" || connection.status === "pending",
  )
    ? text.value.addAccount
    : text.value.connect;
}

const dialogTitle = computed(() => {
  const provider = editing.value;
  if (!provider) return "";
  return provider.configured
    ? text.value.setupEditTitle(provider.display_name)
    : text.value.setupTitle(provider.display_name);
});
</script>

<template>
  <section
    v-if="
      channels.enabled.value ||
      channels.providerViews.value.length ||
      channels.error.value ||
      actionError
    "
    :class="variant === 'settings' ? 'space-y-3' : 'space-y-1'"
  >
    <h3
      v-if="variant === 'sidebar'"
      class="text-muted-foreground px-2 pt-2 text-xs font-medium"
    >
      {{ text.title }}
    </h3>

    <p
      v-if="channels.error.value || actionError"
      role="alert"
      class="px-2 text-sm text-red-600"
    >
      {{ actionError || channels.error.value?.message }}
    </p>

    <article
      v-for="view in channels.providerViews.value"
      :key="view.provider.provider"
      class="border-border"
      :data-testid="`channel-provider-${view.provider.provider}`"
      :class="variant === 'settings' ? 'border-b py-3 last:border-0' : ''"
    >
      <div
        class="flex items-center justify-between gap-3"
        :class="
          variant === 'sidebar'
            ? 'hover:bg-sidebar-accent rounded-md px-2 py-1'
            : ''
        "
      >
        <ChannelProviderIcon
          :provider="view.provider.provider"
          class="shrink-0"
        />
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium">
            {{ view.provider.display_name }}
          </div>
          <p
            v-if="variant === 'settings'"
            class="text-muted-foreground text-xs"
          >
            {{
              text.descriptions[view.provider.provider] ??
              view.provider.display_name
            }}
          </p>
          <span
            v-if="variant === 'settings'"
            class="text-muted-foreground text-xs"
            :data-testid="`channel-status-${view.provider.provider}`"
          >
            {{ statusLabel(view.status) }}
          </span>
        </div>
        <div class="flex shrink-0 flex-wrap justify-end gap-1">
          <button
            type="button"
            class="h-8 w-24 rounded-md border px-2 text-xs"
            :disabled="channels.isProviderPending(view.provider.provider)"
            :title="view.provider.unavailable_reason || undefined"
            @click="connectProvider(view.provider)"
          >
            {{ connectLabel(view) }}
          </button>
          <button
            v-if="
              variant === 'settings' &&
              view.provider.configured &&
              providerCanEditRuntimeConfig(view.provider)
            "
            type="button"
            class="rounded-md border px-2 py-1 text-xs"
            :disabled="channels.isProviderPending(view.provider.provider)"
            @click="beginSetup(view.provider)"
          >
            {{ text.modify }}
          </button>
          <button
            v-if="variant === 'settings' && isAdmin && view.provider.configured"
            type="button"
            class="rounded-md border px-2 py-1 text-xs text-red-600"
            :disabled="channels.isProviderPending(view.provider.provider)"
            :aria-label="`${text.removeProviderConfig}: ${view.provider.display_name}`"
            @click="removingProvider = view.provider"
          >
            {{ text.removeProviderConfig }}
          </button>
        </div>
      </div>

      <div v-if="variant === 'settings'" class="mt-3 space-y-2 pl-8">
        <h4 class="text-xs font-medium">{{ text.accounts }}</h4>
        <p
          v-if="view.connections.length === 0"
          class="text-muted-foreground text-xs"
        >
          {{ text.noAccounts }}
        </p>
        <div
          v-for="connection in view.connections"
          :key="connection.id"
          class="bg-muted/40 flex items-center justify-between gap-3 rounded-md px-3 py-2"
          :data-testid="`channel-connection-${connection.id}`"
        >
          <div class="min-w-0">
            <div class="truncate text-xs font-medium">
              {{ getChannelConnectionLabel(connection) }}
            </div>
            <div class="text-muted-foreground text-xs">
              {{ statusLabel(connection.status) }}
            </div>
          </div>
          <button
            v-if="connection.status !== 'revoked'"
            type="button"
            class="rounded-md border px-2 py-1 text-xs"
            :disabled="channels.isConnectionPending(connection.id)"
            :aria-label="
              text.disconnectAccount(getChannelConnectionLabel(connection))
            "
            @click="disconnectConnection(connection)"
          >
            {{ text.disconnect }}
          </button>
        </div>
      </div>
    </article>
  </section>

  <div
    v-if="editing"
    role="dialog"
    :aria-label="dialogTitle"
    aria-modal="true"
    class="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4"
  >
    <form
      class="bg-background border-border w-full max-w-md rounded-xl border p-5 shadow-xl"
      @submit.prevent="saveRuntimeConfig"
    >
      <h2 class="text-lg font-semibold">{{ dialogTitle }}</h2>
      <p class="text-muted-foreground mt-1 text-sm">
        {{ editing.unavailable_reason || text.setupDescription }}
      </p>
      <div class="mt-4 space-y-3">
        <label
          v-for="field in editing.credential_fields"
          :key="field.name"
          class="block text-sm"
        >
          <span class="mb-1 block">{{ field.label }}</span>
          <input
            v-model="values[field.name]"
            type="text"
            :required="field.required"
            :aria-label="field.label"
            autocomplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            class="border-input w-full rounded-md border px-3 py-2"
            :class="field.type === 'password' ? 'channel-secret-input' : ''"
          />
        </label>
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border px-3 py-2"
          @click="editing = null"
        >
          {{ text.cancel }}
        </button>
        <button
          type="submit"
          class="bg-primary text-primary-foreground rounded-md px-3 py-2"
          :disabled="channels.isProviderPending(editing.provider)"
        >
          {{
            channels.connections.value.some(
              (connection) =>
                connection.provider === editing?.provider &&
                (connection.status === "connected" ||
                  connection.status === "pending"),
            )
              ? text.saveChanges
              : text.saveAndConnect
          }}
        </button>
      </div>
    </form>
  </div>

  <div
    v-if="activeConnectProvider && activeFlow"
    role="dialog"
    :aria-label="text.connectTitle"
    aria-modal="true"
    class="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4"
  >
    <div
      class="bg-background border-border w-full max-w-md rounded-xl border p-5 shadow-xl"
    >
      <h2 class="text-lg font-semibold">{{ text.connectTitle }}</h2>
      <p v-if="activeFlow.response.instruction" class="mt-3 text-sm">
        {{ activeFlow.response.instruction }}
      </p>
      <p v-if="activeFlow.response.url" class="mt-2 text-sm">
        {{ text.connectLinkOpened }}
      </p>
      <p class="mt-2 text-sm" data-testid="channel-connect-state">
        {{
          activeFlow.status === "expired"
            ? text.connectionExpired
            : activeFlow.status === "connected"
              ? text.connected
              : text.waitingForConnection
        }}
      </p>
      <button
        type="button"
        class="mt-5 rounded-md border px-3 py-2"
        @click="closeConnectDialog"
      >
        {{ activeFlow.status === "waiting" ? text.cancel : text.close }}
      </button>
    </div>
  </div>

  <div
    v-if="removingProvider"
    role="dialog"
    :aria-label="text.removeProviderTitle(removingProvider.display_name)"
    aria-modal="true"
    class="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4"
  >
    <div
      class="bg-background border-border w-full max-w-md rounded-xl border p-5 shadow-xl"
    >
      <h2 class="text-lg font-semibold">
        {{ text.removeProviderTitle(removingProvider.display_name) }}
      </h2>
      <p class="mt-3 text-sm">{{ text.removeProviderDescription }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border px-3 py-2"
          @click="removingProvider = null"
        >
          {{ text.cancel }}
        </button>
        <button
          type="button"
          class="rounded-md border px-3 py-2 text-red-600"
          :disabled="channels.isProviderPending(removingProvider.provider)"
          @click="confirmProviderRemoval"
        >
          {{ text.removeProviderConfig }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.channel-secret-input {
  -webkit-text-security: disc;
}
</style>
