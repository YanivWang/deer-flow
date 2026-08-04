<!--
  【文件职责】     提供 M0 的 setup 路由占位。
  【对应 frontend/】 frontend/src/app/(auth)/setup/page.tsx
  【架构位置】     L3
  【主要导出】     /setup 页面
  【依赖关系】     使用 auth layout
  【边界与注意】   完整 setup UI 属于 M7。
-->

<script setup lang="ts">
definePageMeta({ layout: "auth" });
</script>

<template><h1 class="text-2xl font-semibold">Setup</h1></template>
