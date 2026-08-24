<!--
  【文件职责】     提供主会话与 sidecar 共用的输入框视觉边界和统一焦点环。
  【架构位置】     L3
  【主要导出】     默认 ComposerSurface 组件
  【依赖关系】     Tailwind :has() · data-slot=input-group-control
  【边界与注意】   子输入控件不拥有外框；仅标记的 focus-visible 控件驱动 surface ring。
-->

<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

const props = withDefaults(defineProps<{ testId?: string; class?: string }>(), {
  testId: "composer-surface",
  class: "",
});

const classes = computed(() =>
  cn(
    "composer-surface group/input-group border-input/50 dark:bg-background/80 has-[[data-slot=input-group-control]:focus-visible]:border-input has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 relative z-10 flex w-full min-w-0 flex-col rounded-2xl border bg-white/80 shadow-xs backdrop-blur-sm transition-[color,box-shadow] outline-none has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]",
    props.class,
  ),
);
</script>

<template>
  <div data-slot="input-group" :data-testid="testId" :class="classes">
    <slot />
  </div>
</template>

<style scoped>
.composer-surface :deep([data-slot="input-group-control"]:focus-visible) {
  outline: none;
  box-shadow: none;
}

.composer-surface :deep([data-slot="input-group-header"]) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 0.75rem 0;
}

.composer-surface :deep([data-slot="input-group-body"]) {
  min-height: 4rem;
  width: 100%;
  min-width: 0;
  padding: 0.75rem;
}

.composer-surface :deep([data-slot="input-group-footer"]) {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem 0.75rem;
}
</style>
