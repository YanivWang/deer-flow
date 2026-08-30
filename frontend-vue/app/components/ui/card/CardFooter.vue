<!--
  【文件职责】     Card 底部动作区。
  【架构位置】     L2
  【主要导出】     CardFooter 组件
  【依赖关系】     cn
  【边界与注意】   带 border-t 时自动补上内边距，与 React 同一条选择器。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="card-footer"
    :class="cn('flex items-center px-6 [.border-t]:pt-6', props.class)"
  >
    <slot />
  </div>
</template>
