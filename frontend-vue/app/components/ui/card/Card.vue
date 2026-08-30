<!--
  【文件职责】     Card 容器：卡片的外框、背景与竖排间距。
  【架构位置】     L2
  【主要导出】     Card 组件
  【依赖关系】     cn
  【边界与注意】   纯呈现层，逐类对照 React frontend/src/components/ui/card.tsx；
                   禁止依赖业务模块。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="card"
    :class="
      cn(
        'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
