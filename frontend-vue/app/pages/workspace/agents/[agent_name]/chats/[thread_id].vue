<script setup lang="ts">
import { computed } from "vue";

import AgentChat from "@/components/chat/AgentChat.vue";

definePageMeta({ layout: "workspace", key: () => "workspace-agent-chat" });
const route = useRoute();
const agentName = computed(() => {
  const raw = route.params.agent_name;
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
});
</script>

<template>
  <AgentChat :agent-name="agentName" />
</template>
