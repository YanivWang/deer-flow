<!--
  【文件职责】     HoverCard 触发器。
  【架构位置】     L2
  【主要导出】     HoverCardTrigger 组件
  【依赖关系】     Reka HoverCardTrigger
  【边界与注意】   默认 as-child。
-->

<script setup lang="ts">
import {
  HoverCardTrigger,
  type HoverCardTriggerProps,
  useForwardProps,
} from "reka-ui";

const props = withDefaults(defineProps<HoverCardTriggerProps>(), {
  asChild: true,
});
const forwarded = useForwardProps(props);
</script>

<template>
  <HoverCardTrigger data-slot="hover-card-trigger" v-bind="forwarded">
    <slot />
  </HoverCardTrigger>
</template>
