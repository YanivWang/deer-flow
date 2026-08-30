<!--
  【文件职责】     Card 标题。
  【架构位置】     L2
  【主要导出】     CardTitle 组件
  【依赖关系】     cn
  【边界与注意】   渲染 div 而不是 heading——与 React 一致：卡片标题不进
                   文档大纲，读屏器听到的是一段文本。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="card-title"
    :class="cn('leading-none font-semibold', props.class)"
  >
    <slot />
  </div>
</template>
