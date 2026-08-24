<!--
  【文件职责】     提供 Nuxt 应用根节点与布局出口。
  【架构位置】     L3
  【主要导出】     根应用组件
  【依赖关系】     挂载 layouts 与 pages
  【边界与注意】   根节点不包含业务状态。
-->

<script setup lang="ts">
import { onScopeDispose, watch } from "vue";

const { $theme } = useNuxtApp();
const route = useRoute();
const stopRouteTheme = watch(
  () => route.path,
  (path) => $theme.setForcedTheme(path === "/" ? "dark" : null),
  { immediate: true },
);
onScopeDispose(() => {
  stopRouteTheme();
  $theme.dispose();
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
