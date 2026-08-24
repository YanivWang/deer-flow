<!--
  【文件职责】     AlertDialog 根：确认/破坏性动作的 alertdialog 语义容器。
  【架构位置】     L2
  【主要导出】     AlertDialog 组件
  【依赖关系】     Reka AlertDialogRoot
  【边界与注意】   与 Dialog 的区别不是样式：alertdialog 默认不因外点关闭，
                   且要求调用方显式给出 cancel 与 action 两个出口。
-->

<script setup lang="ts">
import {
  AlertDialogRoot,
  useForwardPropsEmits,
  type AlertDialogEmits,
  type AlertDialogProps,
} from "reka-ui";

const props = defineProps<AlertDialogProps>();
const emits = defineEmits<AlertDialogEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <AlertDialogRoot data-slot="alert-dialog" v-bind="forwarded">
    <slot />
  </AlertDialogRoot>
</template>
