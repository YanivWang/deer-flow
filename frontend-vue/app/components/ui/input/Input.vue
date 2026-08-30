<!--
  【文件职责】     单行文本输入的视觉与焦点基线。
  【架构位置】     L2
  【主要导出】     Input 组件
  【依赖关系】     cn
  【边界与注意】   用 v-model 双向绑定；可访问名字由调用方给（aria-label 或
                   关联 label），primitive 不持有产品文案。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
  modelValue?: string | number;
}>();
const emits = defineEmits<{ "update:modelValue": [payload: string] }>();
</script>

<template>
  <input
    data-slot="input"
    :value="props.modelValue"
    :class="
      cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        props.class,
      )
    "
    @input="
      emits('update:modelValue', ($event.target as HTMLInputElement).value)
    "
  />
</template>
