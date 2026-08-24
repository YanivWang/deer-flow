<!--
  【文件职责】     DropdownMenu 分组标题。
  【架构位置】     L2
  【主要导出】     DropdownMenuLabel 组件
  【依赖关系】     Reka DropdownMenuLabel · cn
  【边界与注意】   非可聚焦项，不参与方向键序列。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DropdownMenuLabel,
  type DropdownMenuLabelProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  DropdownMenuLabelProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <DropdownMenuLabel
    data-slot="dropdown-menu-label"
    v-bind="delegated"
    :class="cn('text-muted-foreground px-2 py-1.5 text-xs', props.class)"
  >
    <slot />
  </DropdownMenuLabel>
</template>
