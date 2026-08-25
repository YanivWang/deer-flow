<!--
  【文件职责】     Select 弹出列表层。
  【架构位置】     L2
  【主要导出】     SelectContent 组件
  【依赖关系】     Reka SelectContent/Portal/Viewport · cn
  【边界与注意】   popper 模式下宽度对齐触发器，避免长模型名把列表撑出视口。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  SelectContent,
  SelectPortal,
  SelectViewport,
  type SelectContentEmits,
  type SelectContentProps,
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
  defineProps<SelectContentProps & { class?: HTMLAttributes["class"] }>(),
  {
    position: "popper",
    sideOffset: 4,
    class: undefined,
  },
);
const emits = defineEmits<SelectContentEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <SelectPortal>
    <SelectContent
      data-slot="select-content"
      v-bind="{ ...$attrs, ...delegated }"
      :class="
        cn(
          'bg-popover text-popover-foreground border-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-80 max-h-72 min-w-[var(--reka-select-trigger-width)] overflow-hidden rounded-md border shadow-lg',
          props.class,
        )
      "
      @escape-key-down="emits('escapeKeyDown', $event)"
      @pointer-down-outside="emits('pointerDownOutside', $event)"
      @close-auto-focus="emits('closeAutoFocus', $event)"
    >
      <SelectViewport class="max-h-72 overflow-y-auto p-1">
        <slot />
      </SelectViewport>
    </SelectContent>
  </SelectPortal>
</template>
