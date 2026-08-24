<script setup lang="ts">
/*
  【文件职责】     将主 chat thread 路由接入 AgentChat。
  【架构位置】     L3 application page
  【主要导出】     默认 chat thread page
  【依赖关系】     AgentChat · workspace routing
  【边界与注意】   DeerFlow 路由接线，不属于 L2。
*/
import AgentChat from "@/components/chat/AgentChat.vue";

definePageMeta({ layout: "workspace", key: () => "workspace-chat" });
</script>

<template>
  <AgentChat />
</template>
