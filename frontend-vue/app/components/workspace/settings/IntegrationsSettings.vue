<script setup lang="ts">
import { onMounted, ref } from "vue";

import {
  completeLarkAuthorization,
  completeLarkConfiguration,
  installLarkIntegration,
  loadLarkIntegrationStatus,
  startLarkAuthorization,
  startLarkConfiguration,
} from "@/core/integrations/lark/api";
import type {
  LarkConfigStartResponse,
  LarkIntegrationStatus,
} from "@/core/integrations/lark/types";

const status = ref<LarkIntegrationStatus | null>(null);
const busy = ref(false);
const message = ref<string | null>(null);
const error = ref<string | null>(null);
const calendar = ref(false);
const scope = ref("");
const verificationUrl = ref<string | null>(null);
const pendingConfig = ref<LarkConfigStartResponse | null>(null);

async function load() {
  try {
    status.value = await loadLarkIntegrationStatus();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Failed to load integration";
  }
}

async function install() {
  busy.value = true;
  error.value = null;
  try {
    const result = await installLarkIntegration();
    status.value = result.status;
    message.value = result.message;
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Installation failed";
  } finally {
    busy.value = false;
  }
}

async function authorize() {
  const started = await startLarkAuthorization({
    recommend: false,
    domains: calendar.value ? ["calendar"] : [],
    scope: scope.value.trim() || null,
  });
  verificationUrl.value = started.verification_url;
  globalThis.open?.(started.verification_url, "_blank", "noopener,noreferrer");
  try {
    const completed = await completeLarkAuthorization({
      device_code: started.device_code,
      wait_timeout_seconds: 8,
    });
    status.value = completed.status;
    message.value = completed.status.auth.verified
      ? "Lark authorization is live-verified"
      : completed.status.auth.message;
  } catch {
    // A pending/timeout response leaves the verification URL visible for retry.
  }
}

async function connect() {
  busy.value = true;
  error.value = null;
  try {
    if (!status.value?.app_configured) {
      pendingConfig.value = await startLarkConfiguration({ brand: "feishu" });
      verificationUrl.value = pendingConfig.value.verification_url;
      globalThis.open?.(verificationUrl.value, "_blank", "noopener,noreferrer");
    } else {
      await authorize();
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Connection failed";
  } finally {
    busy.value = false;
  }
}

async function continueConfiguration() {
  if (!pendingConfig.value) return;
  busy.value = true;
  try {
    const configured = await completeLarkConfiguration({
      device_code: pendingConfig.value.device_code,
      brand: pendingConfig.value.brand,
      interval: pendingConfig.value.interval,
      expires_in: pendingConfig.value.expires_in,
    });
    status.value = configured.status;
    pendingConfig.value = null;
    await authorize();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Connection failed";
  } finally {
    busy.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <section class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold">Lark / Feishu CLI</h2>
      <p class="text-muted-foreground text-sm">
        Install the managed skill pack and authorize only the domains your tasks
        need.
      </p>
    </div>
    <p
      v-if="error"
      role="alert"
      class="rounded-md bg-red-50 p-3 text-sm text-red-700"
    >
      {{ error }}
    </p>
    <p
      v-if="message"
      role="status"
      class="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700"
    >
      {{ message }}
    </p>
    <template v-if="status && !status.installed">
      <p class="text-sm">Install the official skill pack first</p>
      <button
        type="button"
        class="bg-primary text-primary-foreground rounded-md px-3 py-2"
        :disabled="busy"
        @click="install"
      >
        Install
      </button>
    </template>
    <template v-else-if="status">
      <div class="rounded-md border p-3 text-sm">
        <div class="font-medium">Sandbox runtime</div>
        <div class="text-muted-foreground">
          {{
            status.sandbox_runtime_mode === "init-container" &&
            status.sandbox_runtime_ready
              ? "Provisioned by init container"
              : (status.sandbox_runtime_detail ?? "Not ready")
          }}
        </div>
      </div>
      <button
        type="button"
        class="rounded-md border px-3 py-2"
        :class="calendar ? 'bg-accent' : ''"
        @click="calendar = !calendar"
      >
        Calendar
      </button>
      <label class="block text-sm"
        ><span class="mb-1 block">Exact OAuth scope</span
        ><input
          v-model="scope"
          aria-label="Exact OAuth scope"
          class="border-input w-full rounded-md border px-3 py-2"
      /></label>
      <button
        type="button"
        class="bg-primary text-primary-foreground rounded-md px-3 py-2"
        :disabled="busy"
        @click="connect"
      >
        {{ status.auth.verified ? "Reconnect Lark" : "Connect Lark" }}
      </button>
      <p v-if="verificationUrl" class="text-sm break-all">
        {{ verificationUrl }}
      </p>
      <button
        v-if="pendingConfig"
        type="button"
        class="rounded-md border px-3 py-2"
        :disabled="busy"
        @click="continueConfiguration"
      >
        I completed browser confirmation, continue
      </button>
    </template>
  </section>
</template>
