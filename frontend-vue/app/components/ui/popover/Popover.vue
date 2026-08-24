<!--
  【文件职责】     Popover 根：锚定的非模态浮层。
  【架构位置】     L2
  【主要导出】     Popover 组件
  【依赖关系】     Reka PopoverRoot
  【边界与注意】   非模态：内容拿到焦点、Escape 关闭、外点关闭，但**不**声明 aria-modal，
                   也不锁背景。需要锁背景的确认流程用 Dialog / AlertDialog。
-->

<script setup lang="ts">
import {
  PopoverRoot,
  useForwardPropsEmits,
  type PopoverRootEmits,
  type PopoverRootProps,
} from "reka-ui";

const props = defineProps<PopoverRootProps>();
const emits = defineEmits<PopoverRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <PopoverRoot data-slot="popover" v-bind="forwarded">
    <slot />
  </PopoverRoot>
</template>
