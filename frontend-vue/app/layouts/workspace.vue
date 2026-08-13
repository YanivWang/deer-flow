<script setup lang="ts">
/*
  【文件职责】     组合 workspace 侧栏、主内容与全局设置面板。
  【对应 frontend/】 src/app/workspace/layout.tsx
  【架构位置】     L3 application shell
  【主要导出】     默认 workspace layout
  【依赖关系】     ThreadSidebar · SettingsDialog · auth middleware
  【边界与注意】   DeerFlow 路由壳，不属于 L2。
*/
import ThreadSidebar from "@/components/workspace/ThreadSidebar.vue";
import SettingsDialog from "@/components/workspace/settings/SettingsDialog.vue";
</script>

<template>
  <div class="bg-background text-foreground flex h-screen overflow-hidden">
    <ThreadSidebar />
    <main class="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      <slot />
    </main>
    <SettingsDialog />
  </div>
</template>
