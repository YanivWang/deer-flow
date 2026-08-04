<!--
  【文件职责】     提供 M0 的登录路由占位。
  【对应 frontend/】 frontend/src/app/(auth)/login/page.tsx
  【架构位置】     L3
  【主要导出】     /login 页面
  【依赖关系】     使用 auth layout
  【边界与注意】   完整认证 UI 属于 M7。
-->

<script setup lang="ts">
definePageMeta({ layout: "auth" });
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold">Login</h1>
    <p class="text-foreground/70 mt-2 text-sm">
      Authentication UI arrives in a later milestone.
    </p>
  </div>
</template>
