<!--
  【文件职责】     Card 描述文本。
  【架构位置】     L2
  【主要导出】     CardDescription 组件
  【依赖关系】     cn
  【边界与注意】   同 CardTitle：div 而非 paragraph，与 React 一致。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="card-description"
    :class="cn('text-muted-foreground text-sm', props.class)"
  >
    <slot />
  </div>
</template>
