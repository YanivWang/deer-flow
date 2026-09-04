<script setup lang="ts">
/*
  【文件职责】     设置页的 channel 面板：每个 provider 的账号列表、连接、配置与管理员删除。
  【架构位置】     L3 product UI
  【主要导出】     默认 ChannelConnections 组件
  【依赖关系】     useChannelConnections · auth session · ChannelRuntimeConfigDialog · ui/dialog · ui/alert-dialog
  【边界与注意】   侧栏是另一个组件（WorkspaceChannelsList.vue），不要再把两者合成一个 variant——
                   理由写在那个文件的头注释里。

                   这里比 React 的 channels-settings-page.tsx 多出多账号列表、逐账号断开与
                   管理员删 provider 配置三件事，是刻意保留的：tests/e2e-channels/channels.spec.ts
                   拿真实 Gateway 钉住了这条生命周期。

                   connections 是这个面板的状态真相（一个 provider 可以挂多个账号，
                   provider.connection_status 只能表达其中最新的一行）；一行都没有时
                   才回落到 provider.connection_status，见 core/channels/state.ts。
                   provider 删除是全局管理员动作，不能伪装成用户断开。
*/

import { computed, ref } from "vue";

import ChannelProviderIcon from "./ChannelProviderIcon.vue";
import ChannelRuntimeConfigDialog from "./ChannelRuntimeConfigDialog.vue";
import SettingsSection from "@/components/workspace/settings/SettingsSection.vue";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  getChannelProviderStatusKey,
  type ChannelProviderView,
} from "@/core/channels/state";
import type {
  ChannelConnection,
  ChannelProvider,
  ChannelProviderId,
  ChannelRuntimeConfigValues,
} from "@/core/channels/types";

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
  if (status === "disabled") return labels.disabled;
  if (status === "unconfigured") return labels.unconfigured;
  if (status === "unavailable") return labels.unavailableShort;
  return status.replaceAll("_", " ");
}

/*
  provider 那一行走 React 的优先级（停用/未配置/不可用先于连接状态）；
  账号那一行不走——账号只有它自己的绑定状态，provider 的运行时状况在上面已经说过一次了。
*/
function providerStatusLabel(view: ChannelProviderView) {
  return statusLabel(getChannelProviderStatusKey(view));
}

function beginSetup(provider: ChannelProvider) {
  editing.value = provider;
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

async function saveRuntimeConfig(
  provider: ChannelProvider,
  values: ChannelRuntimeConfigValues,
) {
  if (channels.isProviderPending(provider.provider)) return;
  const hasActiveConnection = channels.connections.value.some(
    (connection) =>
      connection.provider === provider.provider &&
      (connection.status === "connected" || connection.status === "pending"),
  );
  const connectWindow = hasActiveConnection ? null : prepareWindow(provider);
  actionError.value = null;
  try {
    const next = await channels.configure(provider.provider, values);
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

/*
  连接按钮的文案。第三支「重新连接」是本仓此前缺的一档：上游
  channels-settings-page.tsx:284 在 `connection?.status === "revoked"` 时把
  「连接」换成「重新连接」，本仓对已吊销的连接照样写「连接」——用户看不出这次是
  首次接入还是接回一条断掉的。`channels.reconnect` 也因此一直躺在 unused 里。

  判据用 `view.connections`（与上面 addAccount 那一支同源），而不是上游那个
  `connection`（它只看第一条）：本仓一个 provider 可以挂多个账号，
  「还有活着的账号」优先于「有一条被吊销了」。
*/
function connectLabel(view: ChannelProviderView) {
  if (
    view.connections.some(
      (connection) =>
        connection.status === "connected" || connection.status === "pending",
    )
  ) {
    return text.value.addAccount;
  }
  return view.connections.some((connection) => connection.status === "revoked")
    ? text.value.reconnect
    : text.value.connect;
}
</script>

<template>
  <SettingsSection
    :title="$i18n.t.value.settings.channels.title"
    :description="$i18n.t.value.settings.channels.description"
  >
    <div class="space-y-3">
      <!--
        渠道整体停用、或一个可见 provider 都没有时,照 React 渲染一句说明,
        而不是把整节藏起来。藏起来的代价是用户在设置里找不到「渠道」这一节,
        以为是自己点错了;React 两个分支用的是同一句 settings.channels.disabled。
      -->
      <p
        v-if="
          !channels.enabled.value &&
          !channels.providerViews.value.length &&
          !channels.error.value &&
          !actionError
        "
        class="text-muted-foreground text-sm"
      >
        {{ $i18n.t.value.settings.channels.disabled }}
      </p>
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
        class="border-border border-b py-3 last:border-0"
        :data-testid="`channel-provider-${view.provider.provider}`"
      >
        <div class="flex items-center justify-between gap-3">
          <ChannelProviderIcon
            :provider="view.provider.provider"
            class="shrink-0"
          />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium">
              {{ view.provider.display_name }}
            </div>
            <p class="text-muted-foreground text-xs">
              {{
                text.descriptions[view.provider.provider] ??
                view.provider.display_name
              }}
            </p>
            <span
              class="text-muted-foreground text-xs"
              :data-testid="`channel-status-${view.provider.provider}`"
            >
              {{ providerStatusLabel(view) }}
            </span>
          </div>
          <div class="flex shrink-0 flex-wrap justify-end gap-1">
            <button
              type="button"
              class="h-8 w-24 rounded-md border px-2 text-xs disabled:pointer-events-none disabled:opacity-50"
              :disabled="channels.isProviderPending(view.provider.provider)"
              :title="view.provider.unavailable_reason || undefined"
              @click="connectProvider(view.provider)"
            >
              {{ connectLabel(view) }}
            </button>
            <button
              v-if="
                view.provider.configured &&
                providerCanEditRuntimeConfig(view.provider)
              "
              type="button"
              class="rounded-md border px-2 py-1 text-xs disabled:pointer-events-none disabled:opacity-50"
              :disabled="channels.isProviderPending(view.provider.provider)"
              @click="beginSetup(view.provider)"
            >
              {{ text.modify }}
            </button>
            <button
              v-if="isAdmin && view.provider.configured"
              type="button"
              class="rounded-md border px-2 py-1 text-xs text-red-600 disabled:pointer-events-none disabled:opacity-50"
              :disabled="channels.isProviderPending(view.provider.provider)"
              :aria-label="`${text.removeProviderConfig}: ${view.provider.display_name}`"
              @click="removingProvider = view.provider"
            >
              {{ text.removeProviderConfig }}
            </button>
          </div>
        </div>

        <div class="mt-3 space-y-2 pl-8">
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
              class="rounded-md border px-2 py-1 text-xs disabled:pointer-events-none disabled:opacity-50"
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
    </div>
  </SettingsSection>

  <ChannelRuntimeConfigDialog
    :provider="editing"
    :open="editing !== null"
    :submitting="editing ? channels.isProviderPending(editing.provider) : false"
    @update:open="!$event && (editing = null)"
    @submit="saveRuntimeConfig"
  />

  <Dialog
    :open="Boolean(activeConnectProvider && activeFlow)"
    @update:open="!$event && closeConnectDialog()"
  >
    <DialogContent
      v-if="activeFlow"
      :close-label="$i18n.t.value.primitives.close"
    >
      <DialogHeader>
        <DialogTitle>{{ text.connectTitle }}</DialogTitle>
        <DialogDescription data-testid="channel-connect-state">
          {{
            activeFlow.status === "expired"
              ? text.connectionExpired
              : activeFlow.status === "connected"
                ? text.connected
                : text.waitingForConnection
          }}
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-2 text-sm">
        <p v-if="activeFlow.response.instruction">
          {{ activeFlow.response.instruction }}
        </p>
        <p v-if="activeFlow.response.url">{{ text.connectLinkOpened }}</p>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="closeConnectDialog">
          {{ activeFlow.status === "waiting" ? text.cancel : text.close }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <AlertDialog
    :open="removingProvider !== null"
    @update:open="!$event && (removingProvider = null)"
  >
    <AlertDialogContent v-if="removingProvider">
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ text.removeProviderTitle(removingProvider.display_name) }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ text.removeProviderDescription }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ text.cancel }}</AlertDialogCancel>
        <Button
          variant="destructive"
          :disabled="channels.isProviderPending(removingProvider.provider)"
          @click="confirmProviderRemoval"
        >
          {{ text.removeProviderConfig }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
