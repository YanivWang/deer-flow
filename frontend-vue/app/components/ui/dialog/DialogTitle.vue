<!--
  【文件职责】     Dialog 可访问标题：给对话框提供 aria-labelledby。
  【架构位置】     L2
  【主要导出】     DialogTitle 组件
  【依赖关系】     Reka DialogTitle · cn
  【边界与注意】   每个 DialogContent 必须有一个，视觉不需要时用 sr-only。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { DialogTitle, type DialogTitleProps, useForwardProps } from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  DialogTitleProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <DialogTitle
    data-slot="dialog-title"
    v-bind="delegated"
    :class="cn('text-lg leading-none font-semibold', props.class)"
  >
    <slot />
  </DialogTitle>
</template>
