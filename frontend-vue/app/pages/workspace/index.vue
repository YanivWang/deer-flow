<!--
  【文件职责】     将工作区根路由进入真实默认新聊天页。
  【架构位置】     L3
  【主要导出】     /workspace 页面
  【依赖关系】     Nuxt route middleware · workspace chat route
  【边界与注意】   不恢复 static demo/mock 分支；真实模式固定进入 chats/new。
-->

<script setup lang="ts">
definePageMeta({
  layout: "workspace",
  middleware: [() => navigateTo("/workspace/chats/new", { replace: true })],
});
</script>

<template><div /></template>
