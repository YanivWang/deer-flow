<!--
  【文件职责】     AlertDialog 标题区排版容器。
  【架构位置】     L2
  【主要导出】     AlertDialogHeader 组件
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
    data-slot="alert-dialog-header"
    :class="cn('flex flex-col gap-2 text-left', props.class)"
  >
    <slot />
  </div>
</template>
