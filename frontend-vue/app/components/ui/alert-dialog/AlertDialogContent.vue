<!--
  【文件职责】     AlertDialog 内容层：role="alertdialog"、焦点陷阱与 Escape 出口。
  【架构位置】     L2
  【主要导出】     AlertDialogContent 组件
  【依赖关系】     Reka AlertDialogContent/Overlay/Portal · cn
  【边界与注意】   pending 期间调用方可以 @escape-key-down.prevent 关掉唯一键盘出口，
                   所以此时同一批可见按钮也必须一起 disabled，否则用户会被困住。
                   Reka 全库没有一处 aria-modal，Radix 则在 modal content 上写 true。
                   这不是样式差异：读屏器靠它知道背景已经不可达。所以 modal 语义由
                   本层显式补上，而不是指望底座。非模态浮层（Popover）绝不能加。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  AlertDialogContent,
  AlertDialogOverlay,
  AlertDialogPortal,
  type AlertDialogContentEmits,
  type AlertDialogContentProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

/*
  内容 portal 到 body，组件根是 Portal 而不是内容元素。不关掉 attribute 继承，
  调用方传的 data-testid / aria-label / id 会落到 Portal 上——那是一个不渲染
  任何 DOM 的包装组件，属性直接消失，而且没有任何报错。
*/
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<
    AlertDialogContentProps & {
      class?: HTMLAttributes["class"];
      overlayClass?: HTMLAttributes["class"];
      /** 与 AlertDialog 根的 modal 保持一致；只影响 aria-modal 的声明。 */
      modal?: boolean;
    }
  >(),
  { modal: true },
);
const emits = defineEmits<AlertDialogContentEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const {
    class: _class,
    overlayClass: _overlayClass,
    modal: _modal,
    ...rest
  } = forwarded.value;
  void _class;
  void _overlayClass;
  void _modal;
  return rest;
});
</script>

<template>
  <AlertDialogPortal>
    <AlertDialogOverlay
      data-slot="alert-dialog-overlay"
      :class="
        cn(
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-80 bg-black/50',
          props.overlayClass,
        )
      "
    />
    <AlertDialogContent
      data-slot="alert-dialog-content"
      :aria-modal="props.modal ? 'true' : undefined"
      v-bind="{ ...$attrs, ...delegated }"
      :class="
        cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-80 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border p-5 shadow-2xl duration-200 outline-none sm:max-w-lg',
          props.class,
        )
      "
      @escape-key-down="emits('escapeKeyDown', $event)"
      @open-auto-focus="emits('openAutoFocus', $event)"
      @close-auto-focus="emits('closeAutoFocus', $event)"
    >
      <slot />
    </AlertDialogContent>
  </AlertDialogPortal>
</template>
