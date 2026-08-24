<!--
  【文件职责】     Popover 触发器。
  【架构位置】     L2
  【主要导出】     PopoverTrigger 组件
  【依赖关系】     Reka PopoverTrigger
  【边界与注意】   默认 as-child。
-->

<script setup lang="ts">
import {
  PopoverTrigger,
  type PopoverTriggerProps,
  useForwardProps,
} from "reka-ui";

const props = withDefaults(defineProps<PopoverTriggerProps>(), {
  asChild: true,
});
const forwarded = useForwardProps(props);
</script>

<template>
  <PopoverTrigger data-slot="popover-trigger" v-bind="forwarded">
    <slot />
  </PopoverTrigger>
</template>
