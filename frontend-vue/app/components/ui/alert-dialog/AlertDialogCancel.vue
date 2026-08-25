<!--
  【文件职责】     AlertDialog 的取消出口，同时是打开时的默认焦点。
  【架构位置】     L2
  【主要导出】     AlertDialogCancel 组件
  【依赖关系】     Reka AlertDialogCancel · buttonVariants · cn
  【边界与注意】   破坏性对话框把初始焦点放在取消上，不要改成确认。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  AlertDialogCancel,
  type AlertDialogCancelProps,
  useForwardProps,
} from "reka-ui";

import { buttonVariants } from "@/components/ui/button";
import type { ButtonVariants } from "@/components/ui/button/variants";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<
    AlertDialogCancelProps & {
      class?: HTMLAttributes["class"];
      variant?: ButtonVariants["variant"];
      size?: ButtonVariants["size"];
    }
  >(),
  {
    variant: "outline",
    size: "default",
    class: undefined,
  },
);
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const {
    class: _class,
    variant: _variant,
    size: _size,
    ...rest
  } = forwarded.value;
  void _class;
  void _variant;
  void _size;
  return rest;
});
</script>

<template>
  <AlertDialogCancel
    data-slot="alert-dialog-cancel"
    v-bind="delegated"
    :class="
      cn(
        buttonVariants({ variant: props.variant, size: props.size }),
        props.class,
      )
    "
  >
    <slot />
  </AlertDialogCancel>
</template>
