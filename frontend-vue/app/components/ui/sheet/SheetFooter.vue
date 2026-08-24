<!--
  【文件职责】     Sheet footer 排版容器。
  【架构位置】     L2
  【主要导出】     SheetFooter 组件
  【依赖关系】     cn
  【边界与注意】   只排版，不产生语义角色。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="sheet-footer"
    :class="
      cn(
        'mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
