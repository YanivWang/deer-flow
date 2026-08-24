<!--
  【文件职责】     Sheet 触发器。
  【架构位置】     L2
  【主要导出】     SheetTrigger 组件
  【依赖关系】     Reka DialogTrigger
  【边界与注意】   默认 as-child。
-->

<script setup lang="ts">
import {
  DialogTrigger,
  type DialogTriggerProps,
  useForwardProps,
} from "reka-ui";

const props = withDefaults(defineProps<DialogTriggerProps>(), {
  asChild: true,
});
const forwarded = useForwardProps(props);
</script>

<template>
  <DialogTrigger data-slot="sheet-trigger" v-bind="forwarded">
    <slot />
  </DialogTrigger>
</template>
