<script setup lang="ts">
import AgentChat from "@/components/chat/AgentChat.vue";

definePageMeta({ layout: "workspace", key: () => "workspace-chat" });
</script>

<template>
  <AgentChat />
</template>
