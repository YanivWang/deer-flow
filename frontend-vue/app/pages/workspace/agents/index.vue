<script setup lang="ts">
import { onMounted, ref } from "vue";

import {
  deleteAgent,
  fetchAgentsApiEnabled,
  listAgents,
  updateAgent,
} from "@/core/agents/api";
import {
  readCachedAgentsApiEnabled,
  resolveAgentsApiEnabled,
  writeCachedAgentsApiEnabled,
} from "@/core/agents/feature-cache";
import type { Agent } from "@/core/agents/types";

definePageMeta({ layout: "workspace" });
const agents = ref<Agent[]>([]);
const enabled = ref<boolean | null>(null);
const loading = ref(false);
const error = ref("");
const editing = ref<Agent | null>(null);
const editModel = ref("");
const editTemperature = ref("");
const editMaxTokens = ref("");
const editThinking = ref<"inherit" | "on" | "off">("inherit");
const editReasoning = ref<"inherit" | "low" | "medium" | "high">("inherit");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    agents.value = await listAgents();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Failed to load agents";
  } finally {
    loading.value = false;
  }
}

function beginEdit(agent: Agent) {
  editing.value = agent;
  editModel.value = agent.model ?? "";
  editTemperature.value = agent.model_settings?.temperature?.toString() ?? "";
  editMaxTokens.value = agent.model_settings?.max_tokens?.toString() ?? "";
  editThinking.value =
    agent.thinking_enabled == null
      ? "inherit"
      : agent.thinking_enabled
        ? "on"
        : "off";
  editReasoning.value = agent.reasoning_effort ?? "inherit";
  error.value = "";
}

async function saveEdit() {
  if (!editing.value) return;
  const temperature = editTemperature.value.trim()
    ? Number(editTemperature.value)
    : null;
  const maxTokens = editMaxTokens.value.trim()
    ? Number(editMaxTokens.value)
    : null;
  if (
    temperature != null &&
    (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)
  ) {
    error.value = "Temperature must be between 0 and 2.";
    return;
  }
  if (
    maxTokens != null &&
    (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 200000)
  ) {
    error.value = "Max output tokens must be an integer between 1 and 200000.";
    return;
  }
  try {
    const updated = await updateAgent(editing.value.name, {
      model: editModel.value.trim() || null,
      model_settings:
        temperature != null || maxTokens != null
          ? { temperature, max_tokens: maxTokens }
          : null,
      thinking_enabled:
        editThinking.value === "inherit" ? null : editThinking.value === "on",
      reasoning_effort:
        editReasoning.value === "inherit" ? null : editReasoning.value,
    });
    agents.value = agents.value.map((agent) =>
      agent.name === updated.name ? updated : agent,
    );
    editing.value = null;
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Failed to update agent";
  }
}

async function remove(agent: Agent) {
  if (!globalThis.confirm(`Delete ${agent.name}?`)) return;
  try {
    await deleteAgent(agent.name);
    agents.value = agents.value.filter((item) => item.name !== agent.name);
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Failed to delete agent";
  }
}

onMounted(async () => {
  try {
    const live = await fetchAgentsApiEnabled();
    writeCachedAgentsApiEnabled(live);
    enabled.value = live;
  } catch {
    enabled.value = resolveAgentsApiEnabled(
      undefined,
      readCachedAgentsApiEnabled(),
    );
  }
  if (enabled.value) await load();
});
</script>

<template>
  <div class="size-full">
    <section class="flex size-full flex-col">
      <header class="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 class="text-xl font-semibold">Agents</h1>
          <p class="text-muted-foreground text-sm">
            Build and manage custom agents.
          </p>
        </div>
        <NuxtLink
          v-if="enabled"
          to="/workspace/agents/new"
          class="bg-primary text-primary-foreground rounded-md px-3 py-2"
          >New agent</NuxtLink
        >
      </header>
      <div class="flex-1 overflow-y-auto p-6">
        <p
          v-if="enabled === false"
          class="text-muted-foreground rounded-xl border p-6"
        >
          This feature is not enabled. Please contact your administrator.
        </p>
        <p v-else-if="loading" class="text-muted-foreground">Loading…</p>
        <p v-if="error" role="alert" class="mb-4 text-sm text-red-600">
          {{ error }}
        </p>
        <div
          v-if="enabled && !loading"
          class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <article
            v-for="agent in agents"
            :key="agent.name"
            class="flex flex-col rounded-xl border p-4"
          >
            <h2 class="truncate font-semibold">{{ agent.name }}</h2>
            <p class="text-muted-foreground mt-2 line-clamp-2 text-sm">
              {{ agent.description }}
            </p>
            <div class="mt-3 flex flex-wrap gap-1 text-xs">
              <span v-if="agent.model" class="bg-secondary rounded px-2 py-1">{{
                agent.model
              }}</span
              ><span
                v-for="skill in agent.skills ?? []"
                :key="skill"
                class="rounded border px-2 py-1"
                >{{ skill }}</span
              >
            </div>
            <div class="mt-auto flex gap-2 pt-5">
              <NuxtLink
                :to="`/workspace/agents/${encodeURIComponent(agent.name)}/chats/new`"
                class="bg-primary text-primary-foreground flex-1 rounded-md px-3 py-2 text-center text-sm"
                >Chat</NuxtLink
              ><button
                type="button"
                class="rounded-md border px-3"
                :aria-label="`Settings for ${agent.name}`"
                @click="beginEdit(agent)"
              >
                ⚙</button
              ><button
                type="button"
                class="rounded-md border px-3 text-red-600"
                :aria-label="`Delete ${agent.name}`"
                @click="remove(agent)"
              >
                ×
              </button>
            </div>
          </article>
          <div
            v-if="agents.length === 0"
            class="text-muted-foreground col-span-full rounded-xl border p-8 text-center"
          >
            No custom agents yet.
          </div>
        </div>
      </div>
    </section>

    <div
      v-if="editing"
      role="dialog"
      aria-label="Model settings"
      aria-modal="true"
      class="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4"
    >
      <form
        class="bg-background w-full max-w-md space-y-4 rounded-xl border p-5"
        @submit.prevent="saveEdit"
      >
        <h2 class="text-lg font-semibold">
          Model settings · {{ editing.name }}
        </h2>
        <label class="block text-sm"
          >Model<input
            v-model="editModel"
            placeholder="Inherit default"
            class="border-input mt-1 w-full rounded-md border px-3 py-2"
        /></label>
        <label class="block text-sm"
          >Temperature<input
            v-model="editTemperature"
            type="number"
            min="0"
            max="2"
            step="0.1"
            class="border-input mt-1 w-full rounded-md border px-3 py-2"
        /></label>
        <label class="block text-sm"
          >Max output tokens<input
            v-model="editMaxTokens"
            type="number"
            min="1"
            max="200000"
            class="border-input mt-1 w-full rounded-md border px-3 py-2"
        /></label>
        <label class="block text-sm"
          >Thinking<select
            v-model="editThinking"
            class="border-input mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="inherit">Inherit</option>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select></label
        >
        <label class="block text-sm"
          >Reasoning effort<select
            v-model="editReasoning"
            class="border-input mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="inherit">Inherit</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select></label
        >
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border px-3 py-2"
            @click="editing = null"
          >
            Cancel</button
          ><button
            type="submit"
            class="bg-primary text-primary-foreground rounded-md px-3 py-2"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
