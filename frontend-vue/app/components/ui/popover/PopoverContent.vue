<!--
  【文件职责】     Popover 内容层：定位、焦点进入、Escape 与外点关闭。
  【架构位置】     L2
  【主要导出】     PopoverContent 组件
  【依赖关系】     Reka PopoverContent/Portal · cn
  【边界与注意】   内容是 role="dialog" 但**不是** aria-modal；不要补写 aria-modal。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  PopoverContent,
  PopoverPortal,
  type PopoverContentEmits,
  type PopoverContentProps,
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
  defineProps<PopoverContentProps & { class?: HTMLAttributes["class"] }>(),
  { sideOffset: 4 },
);
const emits = defineEmits<PopoverContentEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <PopoverPortal>
    <PopoverContent
      data-slot="popover-content"
      v-bind="{ ...$attrs, ...delegated }"
      :class="
        cn(
          'bg-popover text-popover-foreground border-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-80 w-72 rounded-xl border p-4 shadow-lg outline-none',
          props.class,
        )
      "
      @escape-key-down="emits('escapeKeyDown', $event)"
      @pointer-down-outside="emits('pointerDownOutside', $event)"
      @focus-outside="emits('focusOutside', $event)"
      @interact-outside="emits('interactOutside', $event)"
      @open-auto-focus="emits('openAutoFocus', $event)"
      @close-auto-focus="emits('closeAutoFocus', $event)"
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>
