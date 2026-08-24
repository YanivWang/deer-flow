<script setup lang="ts">
/*
  【文件职责】     将自定义 agent 与 thread 路由参数接入 AgentChat。
  【架构位置】     L3 application page
  【主要导出】     默认 agent chat page
  【依赖关系】     AgentChat · encoded route params
  【边界与注意】   DeerFlow 路由接线，不属于 L2。
*/
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
