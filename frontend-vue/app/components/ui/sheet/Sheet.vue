<!--
  【文件职责】     Sheet 根：贴边滑出的模态面板，语义上就是 Dialog。
  【架构位置】     L2
  【主要导出】     Sheet 组件
  【依赖关系】     Reka DialogRoot
  【边界与注意】   Sheet 与 Dialog 的差别只在位置与动效；焦点、Escape、aria 完全同源。
-->

<script setup lang="ts">
import {
  DialogRoot,
  useForwardPropsEmits,
  type DialogRootEmits,
  type DialogRootProps,
} from "reka-ui";

const props = defineProps<DialogRootProps>();
const emits = defineEmits<DialogRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DialogRoot data-slot="sheet" v-bind="forwarded">
    <slot />
  </DialogRoot>
</template>
