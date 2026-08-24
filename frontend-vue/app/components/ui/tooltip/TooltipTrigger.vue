<!--
  【文件职责】     Tooltip 触发器：hover 与 focus 两条入口。
  【架构位置】     L2
  【主要导出】     TooltipTrigger 组件
  【依赖关系】     Reka TooltipTrigger
  【边界与注意】   默认 as-child；键盘焦点也要能唤出 tooltip，所以触发器必须可聚焦。
-->

<script setup lang="ts">
import {
  TooltipTrigger,
  type TooltipTriggerProps,
  useForwardProps,
} from "reka-ui";

const props = withDefaults(defineProps<TooltipTriggerProps>(), {
  asChild: true,
});
const forwarded = useForwardProps(props);
</script>

<template>
  <TooltipTrigger data-slot="tooltip-trigger" v-bind="forwarded">
    <slot />
  </TooltipTrigger>
</template>
