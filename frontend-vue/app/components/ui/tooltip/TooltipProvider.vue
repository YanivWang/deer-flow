<!--
  【文件职责】     Tooltip 的延迟与分组上下文。
  【架构位置】     L2
  【主要导出】     TooltipProvider 组件
  【依赖关系】     Reka TooltipProvider
  【边界与注意】   Tooltip.vue 自带一个 provider，只有需要共享 skipDelay 时才手动包一层。
-->

<script setup lang="ts">
import {
  TooltipProvider,
  type TooltipProviderProps,
  useForwardProps,
} from "reka-ui";

const props = withDefaults(defineProps<TooltipProviderProps>(), {
  delayDuration: 500,
});
const forwarded = useForwardProps(props);
</script>

<template>
  <TooltipProvider v-bind="forwarded">
    <slot />
  </TooltipProvider>
</template>
