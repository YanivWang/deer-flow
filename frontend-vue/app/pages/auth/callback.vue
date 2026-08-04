<!--
  【文件职责】     提供 OIDC callback 前端路由占位。
  【对应 frontend/】 frontend/src/app/(auth)/auth/callback/page.tsx
  【架构位置】     L3
  【主要导出】     /auth/callback 页面
  【依赖关系】     使用 auth layout
  【边界与注意】   双入口回跳由 Gateway/代理 gate 验证，不在此实现 provider 逻辑。
-->

<script setup lang="ts">
definePageMeta({ layout: "auth" });
</script>

<template><p>Completing authentication…</p></template>
