<!--
  【文件职责】     提供 M0 的 Button 视觉与交互基线。
  【架构位置】     L2
  【主要导出】     Button 组件
  【依赖关系】     消费 buttonVariants 与 cn
  【边界与注意】   保持 data-slot/data-variant 选择器合同。
-->

<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariants } from "./variants";

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants["variant"];
    size?: ButtonVariants["size"];
    class?: string;
    type?: "button" | "submit" | "reset";
  }>(),
  { variant: "default", size: "default", class: "", type: "button" },
);

const classes = computed(() =>
  cn(buttonVariants({ variant: props.variant, size: props.size }), props.class),
);
</script>

<template>
  <button
    data-slot="button"
    :data-variant="variant"
    :data-size="size"
    :type="type"
    :class="classes"
  >
    <slot />
  </button>
</template>
