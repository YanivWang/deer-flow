<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import {
  configureChannelProvider,
  connectChannelProvider,
} from "@/core/channels/api";
import {
  providerCanEditRuntimeConfig,
  providerNeedsRuntimeConfig,
} from "@/core/channels/provider-state";
import type {
  ChannelProvider,
  ChannelRuntimeConfigValues,
} from "@/core/channels/types";
import { useChannels } from "@/composables/useChannels";

withDefaults(defineProps<{ variant?: "sidebar" | "settings" }>(), {
  variant: "sidebar",
});
const channels = useChannels();
const editing = ref<ChannelProvider | null>(null);
const values = ref<ChannelRuntimeConfigValues>({});
const saving = ref(false);
const actionError = ref<string | null>(null);
const connectInstruction = ref<string | null>(null);

const descriptions: Record<string, string> = {
  telegram: "Telegram direct messages",
  slack: "Slack workspace messages",
  discord: "Discord server messages",
  feishu: "Feishu and Lark messages",
  dingtalk: "DingTalk Stream Push messages",
  wechat: "WeChat iLink messages",
  wecom: "WeCom messages",
};

onMounted(() => void channels.refresh());

function isConnected(provider: ChannelProvider) {
  return provider.connection_status === "connected";
}

function beginSetup(provider: ChannelProvider) {
  editing.value = provider;
  values.value = { ...(provider.credential_values ?? {}) };
  actionError.value = null;
}

async function beginConnect(provider: ChannelProvider) {
  actionError.value = null;
  connectInstruction.value = null;
  if (providerNeedsRuntimeConfig(provider)) {
    beginSetup(provider);
    return;
  }
  if (isConnected(provider) && providerCanEditRuntimeConfig(provider)) {
    beginSetup(provider);
    return;
  }
  try {
    const result = await connectChannelProvider(provider.provider);
    connectInstruction.value = result.instruction;
  } catch (cause) {
    actionError.value =
      cause instanceof Error ? cause.message : "Failed to connect channel";
  }
}

async function saveRuntimeConfig() {
  if (!editing.value || saving.value) return;
  const provider = editing.value;
  saving.value = true;
  actionError.value = null;
  try {
    const next = await configureChannelProvider(
      provider.provider,
      values.value,
    );
    channels.replaceProvider(next);
    // The write response deliberately need not echo stored secret placeholders
    // or the provider's field schema. Re-read the authoritative provider state
    // before a connected entry can be opened for editing again.
    await channels.refresh();
    editing.value = null;
    if (next.connection_status !== "connected") {
      const result = await connectChannelProvider(next.provider);
      connectInstruction.value = result.instruction;
    }
  } catch (cause) {
    actionError.value =
      cause instanceof Error
        ? cause.message
        : "Failed to save channel settings";
  } finally {
    saving.value = false;
  }
}

const dialogTitle = computed(() => {
  if (!editing.value) return "";
  return `${editing.value.configured ? "Modify" : "Connect"} ${editing.value.display_name}`;
});
</script>

<template>
  <section
    v-if="channels.enabled.value || channels.providers.value.length"
    :class="variant === 'settings' ? 'space-y-3' : 'space-y-1'"
  >
    <h3
      v-if="variant === 'sidebar'"
      class="text-muted-foreground px-2 pt-2 text-xs font-medium"
    >
      Channels
    </h3>
    <div
      v-for="provider in channels.providers.value"
      :key="provider.provider"
      class="border-border flex items-center justify-between gap-3"
      :class="
        variant === 'settings'
          ? 'border-b py-3 last:border-0'
          : 'hover:bg-sidebar-accent rounded-md px-2 py-1'
      "
    >
      <div class="min-w-0">
        <div class="truncate text-sm font-medium">
          {{ provider.display_name }}
        </div>
        <p v-if="variant === 'settings'" class="text-muted-foreground text-xs">
          {{ descriptions[provider.provider] ?? provider.display_name }}
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-md border px-2 py-1 text-xs"
        @click="beginConnect(provider)"
      >
        {{
          variant === "settings" && provider.configured
            ? "Modify"
            : isConnected(provider)
              ? "Connected"
              : "Connect"
        }}
      </button>
    </div>
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
      <p
        v-if="editing.unavailable_reason"
        class="text-muted-foreground mt-1 text-sm"
      >
        {{ editing.unavailable_reason }}
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
      <p v-if="actionError" role="alert" class="mt-3 text-sm text-red-600">
        {{ actionError }}
      </p>
      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border px-3 py-2"
          @click="editing = null"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="bg-primary text-primary-foreground rounded-md px-3 py-2"
          :disabled="saving"
        >
          Save and connect
        </button>
      </div>
    </form>
  </div>

  <div
    v-if="connectInstruction"
    role="dialog"
    aria-label="Channel connection"
    aria-modal="true"
    class="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4"
  >
    <div
      class="bg-background border-border w-full max-w-md rounded-xl border p-5 shadow-xl"
    >
      <h2 class="text-lg font-semibold">Connect channel</h2>
      <p class="mt-3 text-sm">{{ connectInstruction }}</p>
      <button
        type="button"
        class="mt-5 rounded-md border px-3 py-2"
        @click="connectInstruction = null"
      >
        Close
      </button>
    </div>
  </div>
</template>

<style scoped>
.channel-secret-input {
  -webkit-text-security: disc;
}
</style>
