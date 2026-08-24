<!--
  【文件职责】     DropdownMenu 触发器。
  【架构位置】     L2
  【主要导出】     DropdownMenuTrigger 组件
  【依赖关系】     Reka DropdownMenuTrigger
  【边界与注意】   默认 as-child：aria-haspopup/aria-expanded/data-state 落在调用方按钮上。
-->

<script setup lang="ts">
import {
  DropdownMenuTrigger,
  type DropdownMenuTriggerProps,
  useForwardProps,
} from "reka-ui";

const props = withDefaults(defineProps<DropdownMenuTriggerProps>(), {
  asChild: true,
});
const forwarded = useForwardProps(props);
</script>

<template>
  <DropdownMenuTrigger data-slot="dropdown-menu-trigger" v-bind="forwarded">
    <slot />
  </DropdownMenuTrigger>
</template>
