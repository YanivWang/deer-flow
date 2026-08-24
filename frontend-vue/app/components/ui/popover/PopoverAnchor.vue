<!--
  【文件职责】     Popover 定位锚点，用于「程序打开、没有触发按钮」的浮层。
  【架构位置】     L2
  【主要导出】     PopoverAnchor 组件
  【依赖关系】     Reka PopoverAnchor
  【边界与注意】   受控 open + Anchor 是没有触发器时的正确形状；不要为了拿定位而伪造一个按钮。
-->

<script setup lang="ts">
import {
  PopoverAnchor,
  type PopoverAnchorProps,
  useForwardProps,
} from "reka-ui";

const props = withDefaults(defineProps<PopoverAnchorProps>(), {
  asChild: true,
});
const forwarded = useForwardProps(props);
</script>

<template>
  <PopoverAnchor data-slot="popover-anchor" v-bind="forwarded">
    <slot />
  </PopoverAnchor>
</template>
