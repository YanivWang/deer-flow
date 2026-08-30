<!--
  【文件职责】     Card 头部右上角的动作位。
  【架构位置】     L2
  【主要导出】     CardAction 组件
  【依赖关系】     cn
  【边界与注意】   data-slot 是 CardHeader 切两列的触发器，不能改名。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="card-action"
    :class="
      cn(
        'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
