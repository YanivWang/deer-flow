<!--
  【文件职责】     Card 头部网格：标题、描述与右上角动作各占一格。
  【架构位置】     L2
  【主要导出】     CardHeader 组件
  【依赖关系】     cn
  【边界与注意】   有 CardAction 时靠 has-data-[slot=card-action] 变两列，
                   所以动作必须是 CardAction 而不是裸元素。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="card-header"
    :class="
      cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
