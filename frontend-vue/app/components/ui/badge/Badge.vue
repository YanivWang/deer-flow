<!--
  【文件职责】     行内状态标签。
  【架构位置】     L2
  【主要导出】     Badge 组件
  【依赖关系】     消费 badgeVariants 与 cn
  【边界与注意】   渲染 span：它是一段被样式化的文本，不是控件，别给它 role。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

import { badgeVariants, type BadgeVariants } from "./variants";

const props = withDefaults(
  defineProps<{
    variant?: BadgeVariants["variant"];
    class?: HTMLAttributes["class"];
  }>(),
  { variant: "default", class: undefined },
);

const classes = computed(() =>
  cn(badgeVariants({ variant: props.variant }), props.class),
);
</script>

<template>
  <span data-slot="badge" :class="classes">
    <slot />
  </span>
</template>
