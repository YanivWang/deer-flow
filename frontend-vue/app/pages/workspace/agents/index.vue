<script setup lang="ts">
import { onMounted, ref } from "vue";

import { listAgents } from "@/core/agents/api";
import type { Agent } from "@/core/agents/types";

definePageMeta({ layout: "workspace" });
const agents = ref<Agent[]>([]);
onMounted(async () => {
  try {
    agents.value = await listAgents();
  } catch {
    agents.value = [];
  }
});
</script>

<template>
  <section class="mx-auto max-w-5xl space-y-6 p-8">
    <h1 class="text-2xl font-semibold">Agents</h1>
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="agent in agents"
        :key="agent.name"
        :to="`/workspace/agents/${encodeURIComponent(agent.name)}/chats/new`"
        class="border-border hover:bg-accent rounded-xl border p-5"
      >
        <h2 class="font-semibold">{{ agent.name }}</h2>
        <p class="mt-2 text-sm text-gray-500">{{ agent.description }}</p>
      </NuxtLink>
    </div>
  </section>
</template>
