<script setup lang="ts">
import { ref } from "vue";

import AgentChat from "@/components/chat/AgentChat.vue";
import {
  AgentNameCheckError,
  AgentsApiDisabledError,
  checkAgentName,
} from "@/core/agents/api";

definePageMeta({ layout: "workspace" });
const name = ref("");
const confirmedName = ref<string | null>(null);
const checking = ref(false);
const error = ref("");
const namePattern = /^[A-Za-z0-9-]+$/;

async function continueSetup() {
  const candidate = name.value.trim();
  error.value = "";
  if (!namePattern.test(candidate)) {
    error.value = "Invalid name — use only letters, digits, and hyphens";
    return;
  }
  checking.value = true;
  try {
    const result = await checkAgentName(candidate);
    if (!result.available) {
      error.value = "An agent with this name already exists";
      return;
    }
    confirmedName.value = candidate;
  } catch (cause) {
    error.value =
      cause instanceof AgentsApiDisabledError
        ? "Custom agent management is not enabled on this server."
        : cause instanceof AgentNameCheckError && cause.detail
          ? `Name check failed: ${cause.detail}`
          : "Could not verify name availability — please try again";
  } finally {
    checking.value = false;
  }
}
</script>

<template>
  <div v-if="confirmedName" class="size-full">
    <AgentChat :agent-name="confirmedName" bootstrap />
  </div>
  <main v-else class="flex size-full items-center justify-center p-6">
    <form
      class="w-full max-w-sm space-y-5 text-center"
      @submit.prevent="continueSetup"
    >
      <div class="text-4xl" aria-hidden="true">🤖</div>
      <div>
        <h1 class="text-xl font-semibold">Create custom agent</h1>
        <p class="text-muted-foreground mt-2 text-sm">
          Choose a stable name. DeerFlow will then help you design the agent
          through the normal run lifecycle.
        </p>
      </div>
      <input
        v-model="name"
        required
        aria-label="Agent name"
        placeholder="Agent name"
        class="border-input w-full rounded-md border px-3 py-2 text-left"
      />
      <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
      <button
        type="submit"
        class="bg-primary text-primary-foreground w-full rounded-md px-3 py-2"
        :disabled="checking"
      >
        {{ checking ? "Checking…" : "Continue" }}
      </button>
    </form>
  </main>
</template>
