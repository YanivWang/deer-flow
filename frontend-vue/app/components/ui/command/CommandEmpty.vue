<!--
  【文件职责】     Command 无结果占位。
  【架构位置】     L2
  【主要导出】     CommandEmpty 组件
  【依赖关系】     cn
  【边界与注意】   文案由调用方提供；此处只负责排版。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <p
    data-slot="command-empty"
    :class="
      cn('text-muted-foreground px-3 py-6 text-center text-sm', props.class)
    "
  >
    <slot />
  </p>
</template>
