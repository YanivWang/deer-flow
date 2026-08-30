<!--
  【文件职责】     行内提示块：role=alert 的容器与两列网格。
  【架构位置】     L2
  【主要导出】     Alert 组件
  【依赖关系】     消费 alertVariants 与 cn
  【边界与注意】   role 写在 primitive 上，与 React 一致——这决定读屏器会不会
                   打断当前朗读，是可观察行为，不是样式。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

import { alertVariants, type AlertVariants } from "./variants";

const props = withDefaults(
  defineProps<{
    variant?: AlertVariants["variant"];
    class?: HTMLAttributes["class"];
  }>(),
  { variant: "default", class: undefined },
);

const classes = computed(() =>
  cn(alertVariants({ variant: props.variant }), props.class),
);
</script>

<template>
  <div data-slot="alert" role="alert" :class="classes">
    <slot />
  </div>
</template>
