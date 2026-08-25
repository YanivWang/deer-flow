<!--
  【文件职责】     AlertDialog 的确认出口。
  【架构位置】     L2
  【主要导出】     AlertDialogAction 组件
  【依赖关系】     Reka AlertDialogAction · buttonVariants · cn
  【边界与注意】   默认不自动关闭：破坏性写入常常需要先等请求结果再决定关不关，
                   所以 as-child 由调用方决定用 Reka 的关闭语义还是自己的按钮。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  AlertDialogAction,
  type AlertDialogActionProps,
  useForwardProps,
} from "reka-ui";

import { buttonVariants } from "@/components/ui/button";
import type { ButtonVariants } from "@/components/ui/button/variants";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<
    AlertDialogActionProps & {
      class?: HTMLAttributes["class"];
      variant?: ButtonVariants["variant"];
      size?: ButtonVariants["size"];
    }
  >(),
  {
    variant: "default",
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
  <AlertDialogAction
    data-slot="alert-dialog-action"
    v-bind="delegated"
    :class="
      cn(
        buttonVariants({ variant: props.variant, size: props.size }),
        props.class,
      )
    "
  >
    <slot />
  </AlertDialogAction>
</template>
