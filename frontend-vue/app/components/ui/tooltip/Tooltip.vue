<!--
  【文件职责】     Tooltip 根。
  【架构位置】     L2
  【主要导出】     Tooltip 组件
  【依赖关系】     Reka TooltipRoot · TooltipProvider
  【边界与注意】   tooltip 只是**补充**说明：触发器自身必须已经有可访问名字，
                   不能靠 tooltip 来命名一个没有 aria-label 的图标按钮。
-->

<script setup lang="ts">
import {
  TooltipRoot,
  useForwardPropsEmits,
  type TooltipRootEmits,
  type TooltipRootProps,
} from "reka-ui";

import TooltipProvider from "./TooltipProvider.vue";

const props = defineProps<TooltipRootProps>();
const emits = defineEmits<TooltipRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <TooltipProvider>
    <TooltipRoot data-slot="tooltip" v-bind="forwarded">
      <slot />
    </TooltipRoot>
  </TooltipProvider>
</template>
