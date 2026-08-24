<!--
  【文件职责】     Dialog 根：持有 open 状态与 modal 语义。
  【架构位置】     L2
  【主要导出】     Dialog 组件
  【依赖关系】     Reka DialogRoot
  【边界与注意】   不含任何产品文案；标题/描述/关闭标签由调用方提供。
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
  <DialogRoot data-slot="dialog" v-bind="forwarded">
    <slot />
  </DialogRoot>
</template>
