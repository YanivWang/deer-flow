<script setup lang="ts">
import { onMounted, ref } from "vue";

import { loadMCPConfig, updateMCPServerState } from "@/core/mcp/api";
import type { MCPConfig } from "@/core/mcp/types";

const config = ref<MCPConfig | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    config.value = await loadMCPConfig();
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "Failed to load MCP configuration";
  } finally {
    loading.value = false;
  }
}

async function toggle(name: string, enabled: boolean) {
  if (loading.value) return;
  loading.value = true;
  error.value = null;
  try {
    await updateMCPServerState(name, enabled);
    config.value = await loadMCPConfig();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Failed to update MCP server";
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <section class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold">Tools</h2>
      <p class="text-muted-foreground text-sm">
        Enable or disable configured MCP tool servers.
      </p>
    </div>
    <p
      v-if="error"
      role="alert"
      class="rounded-md bg-red-50 p-3 text-sm text-red-700"
    >
      {{ error }}
    </p>
    <div
      v-for="(server, name) in config?.mcp_servers ?? {}"
      :key="name"
      class="border-border flex items-center justify-between border-b py-3"
    >
      <div>
        <div class="font-medium">{{ name }}</div>
        <div class="text-muted-foreground text-xs">
          {{ server.description }}
        </div>
      </div>
      <input
        type="checkbox"
        role="switch"
        :aria-label="String(name)"
        :checked="server.enabled"
        :disabled="loading"
        @change="
          toggle(String(name), ($event.target as HTMLInputElement).checked)
        "
      />
    </div>
  </section>
</template>
