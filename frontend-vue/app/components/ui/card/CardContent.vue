<!--
  【文件职责】     Card 正文区。
  【架构位置】     L2
  【主要导出】     CardContent 组件
  【依赖关系】     cn
  【边界与注意】   只负责左右内边距，竖向间距由 Card 的 gap 给。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div data-slot="card-content" :class="cn('px-6', props.class)">
    <slot />
  </div>
</template>
