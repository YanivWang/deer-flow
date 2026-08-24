<!--
  【文件职责】     AlertDialog 可访问标题。
  【架构位置】     L2
  【主要导出】     AlertDialogTitle 组件
  【依赖关系】     Reka AlertDialogTitle · cn
  【边界与注意】   每个 AlertDialogContent 必须有一个。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  AlertDialogTitle,
  type AlertDialogTitleProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  AlertDialogTitleProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <AlertDialogTitle
    data-slot="alert-dialog-title"
    v-bind="delegated"
    :class="cn('text-lg leading-none font-semibold', props.class)"
  >
    <slot />
  </AlertDialogTitle>
</template>
