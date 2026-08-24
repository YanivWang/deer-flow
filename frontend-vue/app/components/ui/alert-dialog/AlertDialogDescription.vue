<!--
  【文件职责】     AlertDialog 可访问描述。
  【架构位置】     L2
  【主要导出】     AlertDialogDescription 组件
  【依赖关系】     Reka AlertDialogDescription · cn
  【边界与注意】   视觉不需要时用 sr-only，不要省略。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  AlertDialogDescription,
  type AlertDialogDescriptionProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  AlertDialogDescriptionProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <AlertDialogDescription
    data-slot="alert-dialog-description"
    v-bind="delegated"
    :class="cn('text-muted-foreground text-sm', props.class)"
  >
    <slot />
  </AlertDialogDescription>
</template>
