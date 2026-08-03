<script setup lang="ts">
import { computed } from "vue";

import WorkspaceChatWidget from "../../../../../widgets/workspace/chat/WorkspaceChatWidget.vue";

const route = useRoute();
const agentName = computed(() => String(route.params.agent_name ?? ""));
const threadId = computed(() => String(route.params.thread_id ?? ""));
</script>

<template>
  <WorkspaceChatWidget :agent-name="agentName" :thread-id="threadId" />
</template>
