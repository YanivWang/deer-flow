<!--
  【文件职责】     Sheet 关闭控件。
  【架构位置】     L2
  【主要导出】     SheetClose 组件
  【依赖关系】     Reka DialogClose
  【边界与注意】   默认 as-child，可见文案由调用方提供。
-->

<script setup lang="ts">
import { DialogClose, type DialogCloseProps, useForwardProps } from "reka-ui";

const props = withDefaults(defineProps<DialogCloseProps>(), { asChild: true });
const forwarded = useForwardProps(props);
</script>

<template>
  <DialogClose data-slot="sheet-close" v-bind="forwarded">
    <slot />
  </DialogClose>
</template>
