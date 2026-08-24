<!--
  【文件职责】     Dialog 遮罩层。
  【架构位置】     L2
  【主要导出】     DialogOverlay 组件
  【依赖关系】     Reka DialogOverlay · cn
  【边界与注意】   z-index 交给调用方覆盖，默认与 DialogContent 同层。
-->

<script setup lang="ts">
/*
  【z-index 约定】所有 portal 到 body 的浮层共用 `z-80` 这一层，谁后打开谁在上——
  顺序由 DOM 决定，而不是靠给每种浮层排一个越来越大的数字。那种「阶梯」写法在
  嵌套时必然出错：对话框里打开的 Select 一定比对话框自己晚出现，但它的固定层级
  可能比对话框低，于是列表被自己的遮罩挡住、看得见点不动。
  只有 tooltip 用 `z-90`：它不捕获焦点、不接管交互，永远只是浮在最上面的补充说明。
  应用自身的 fixed 元素停在 `z-50`，toaster 的 `z-[120]` 仍在所有浮层之上。
*/
import { computed, type HTMLAttributes } from "vue";
import {
  DialogOverlay,
  type DialogOverlayProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  DialogOverlayProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <DialogOverlay
    data-slot="dialog-overlay"
    v-bind="delegated"
    :class="
      cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-80 bg-black/50',
        props.class,
      )
    "
  />
</template>
