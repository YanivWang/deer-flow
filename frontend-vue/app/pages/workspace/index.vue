<!--
  【文件职责】     提供 M0 workspace 空壳，用于路由和 auth-disabled 验证。
  【对应 frontend/】 frontend/src/app/workspace/page.tsx
  【架构位置】     L3
  【主要导出】     /workspace 页面
  【依赖关系】     使用 workspace layout
  【边界与注意】   不提前实现聊天、thread、message 或 artifact UI。
-->

<script setup lang="ts">
definePageMeta({ layout: "workspace" });
</script>

<template>
  <section data-m0-workspace class="rounded-xl border border-dashed p-8">
    <h1 class="text-2xl font-semibold">Workspace foundation ready</h1>
    <p class="text-foreground/70 mt-2">
      This intentionally empty shell validates routing and auth-disabled
      behavior.
    </p>
  </section>
</template>
