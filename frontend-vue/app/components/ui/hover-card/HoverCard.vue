<!--
  【文件职责】     HoverCard 根：悬停/聚焦触发的富内容预览。
  【架构位置】     L2
  【主要导出】     HoverCard 组件
  【依赖关系】     Reka HoverCardRoot
  【边界与注意】   内容是补充预览，不能承载唯一入口的操作——纯键盘用户只有焦点一条路径。
-->

<script setup lang="ts">
import {
  HoverCardRoot,
  useForwardPropsEmits,
  type HoverCardRootEmits,
  type HoverCardRootProps,
} from "reka-ui";

const props = defineProps<HoverCardRootProps>();
const emits = defineEmits<HoverCardRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <HoverCardRoot data-slot="hover-card" v-bind="forwarded">
    <slot />
  </HoverCardRoot>
</template>
