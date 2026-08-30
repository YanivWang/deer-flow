<!--
  【文件职责】     Select 选项之间的分隔线。
  【架构位置】     L2
  【主要导出】     SelectSeparator 组件
  【依赖关系】     Reka SelectSeparator · cn
  【边界与注意】   样式与 React 的同名件逐字一致；它不可点，也不进可访问性树。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  SelectSeparator,
  type SelectSeparatorProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  SelectSeparatorProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <SelectSeparator
    data-slot="select-separator"
    v-bind="delegated"
    :class="cn('bg-border pointer-events-none -mx-1 my-1 h-px', props.class)"
  />
</template>
