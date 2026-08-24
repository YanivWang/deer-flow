<!--
  【文件职责】     提供主会话与 sidecar 共用的输入框视觉边界和统一焦点环。
  【对应 frontend/】 src/components/ui/input-group.tsx::InputGroup
  【架构位置】     L3
  【主要导出】     默认 ComposerSurface 组件
  【依赖关系】     Tailwind :has() · data-slot=input-group-control
  【边界与注意】   子输入控件不拥有外框；仅标记的 focus-visible 控件驱动 surface ring。
-->

<script setup lang="ts">
withDefaults(defineProps<{ testId?: string }>(), {
  testId: "composer-surface",
});
</script>

<template>
  <div
    data-slot="input-group"
    :data-testid="testId"
    class="composer-surface group/input-group border-input/50 dark:bg-background/80 has-[[data-slot=input-group-control]:focus-visible]:border-input has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 relative z-10 flex w-full min-w-0 flex-col rounded-2xl border bg-white/80 p-2 shadow-xs backdrop-blur-sm transition-[color,box-shadow] outline-none has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]"
  >
    <slot />
  </div>
</template>

<style scoped>
.composer-surface :deep([data-slot="input-group-control"]:focus-visible) {
  outline: none;
  box-shadow: none;
}
</style>
