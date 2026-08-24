<script setup lang="ts">
/*
  【文件职责】     校验 allowlist 后展示公开、只读的静态线程案例。
  【架构位置】     L3
  【主要导出】     /showcase/:thread_id 页面
  【依赖关系】     AgentChat · shared/showcase
  【边界与注意】   未登记 thread 必须 404；demo prop 关闭所有写入与 workspace 控件。
*/
import AgentChat from "@/components/chat/AgentChat.vue";
import { isDemoThreadId } from "#shared/showcase";

definePageMeta({
  layout: "showcase",
  validate: (route) => {
    const raw = route.params.thread_id;
    const threadId = Array.isArray(raw) ? raw[0] : raw;
    return typeof threadId === "string" && isDemoThreadId(threadId);
  },
});
</script>

<template>
  <AgentChat demo />
</template>
