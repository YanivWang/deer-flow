<!--
  【文件职责】     Select 分组标题。
  【架构位置】     L2
  【主要导出】     SelectLabel 组件
  【依赖关系】     Reka SelectLabel · cn
  【边界与注意】   文案由调用方提供；样式与 React 的同名件逐字一致。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { SelectLabel, type SelectLabelProps, useForwardProps } from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  SelectLabelProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <SelectLabel
    data-slot="select-label"
    v-bind="delegated"
    :class="cn('text-muted-foreground px-2 py-1.5 text-xs', props.class)"
  >
    <slot />
  </SelectLabel>
</template>
