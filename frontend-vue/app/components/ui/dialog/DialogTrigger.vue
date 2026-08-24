<!--
  【文件职责】     Dialog 触发器：保持 aria-haspopup/aria-expanded 与焦点归还。
  【架构位置】     L2
  【主要导出】     DialogTrigger 组件
  【依赖关系】     Reka DialogTrigger
  【边界与注意】   默认 as-child，由调用方提供真实语义按钮。
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
  <DialogTrigger data-slot="dialog-trigger" v-bind="forwarded">
    <slot />
  </DialogTrigger>
</template>
