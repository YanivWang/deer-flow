<script setup lang="ts">
import { computed } from "vue";

import WorkspaceChatWidget from "../../../widgets/workspace/chat/WorkspaceChatWidget.vue";

const route = useRoute();
const threadId = computed(() => String(route.params.thread_id ?? ""));
const agentName = computed(() => null);
</script>

<template>
  <WorkspaceChatWidget :agent-name="agentName" :thread-id="threadId" />
</template>
