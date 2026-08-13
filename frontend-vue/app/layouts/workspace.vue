<script setup lang="ts">
import { computed } from "vue";

import ThreadSidebar from "@/components/workspace/ThreadSidebar.vue";

const route = useRoute();
const agentName = computed(() => {
  const raw = route.params.agent_name;
  return Array.isArray(raw) ? raw[0] : raw;
});
</script>

<template>
  <div class="bg-background text-foreground flex h-screen overflow-hidden">
    <ThreadSidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="border-border flex h-14 shrink-0 items-center border-b px-6 font-semibold"
      >
        <span v-if="agentName">{{ agentName }}</span>
        <span v-else>Workspace</span>
      </header>
      <main class="min-h-0 flex-1 overflow-auto"><slot /></main>
    </div>
  </div>
</template>
