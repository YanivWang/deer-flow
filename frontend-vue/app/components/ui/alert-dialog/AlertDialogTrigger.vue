<!--
  【文件职责】     AlertDialog 触发器。
  【架构位置】     L2
  【主要导出】     AlertDialogTrigger 组件
  【依赖关系】     Reka AlertDialogTrigger
  【边界与注意】   默认 as-child。
-->

<script setup lang="ts">
import {
  AlertDialogTrigger,
  type AlertDialogTriggerProps,
  useForwardProps,
} from "reka-ui";

const props = withDefaults(defineProps<AlertDialogTriggerProps>(), {
  asChild: true,
});
const forwarded = useForwardProps(props);
</script>

<template>
  <AlertDialogTrigger data-slot="alert-dialog-trigger" v-bind="forwarded">
    <slot />
  </AlertDialogTrigger>
</template>
