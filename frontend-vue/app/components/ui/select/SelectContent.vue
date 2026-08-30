<!--
  【文件职责】     Select 弹出列表层。
  【架构位置】     L2
  【主要导出】     SelectContent 组件
  【依赖关系】     Reka SelectContent/Portal/Viewport · SelectScrollUp/DownButton · cn
  【边界与注意】   默认 `position="item-aligned"` / `align="center"`，与 React 的同名件
                   一致（frontend/src/components/ui/select.tsx）。item-aligned 是把
                   **选中项**叠在触发器上的原生下拉行为，popper 是浮层贴在触发器下方——
                   展开时它们看起来根本不是一个控件。

                   这里原本默认 popper，理由写的是「宽度对齐触发器，避免长模型名把列表
                   撑出视口」。实测那条理由不成立：popper 只加了 `min-width`（下限），
                   长内容照样把列表撑宽；真正管住宽度的是 Content 上的
                   `overflow-x-hidden`，两种模式都有。

                   弹层会把页面其余部分挡在可访问性树之外（展开后整棵树只剩 listbox），
                   所以**对照台账报不出这一层的任何差异**——包括下面两颗滚动按钮的缺席，
                   它们是 aria-hidden 的。这一层只能照着 React 逐行对，由
                   tests/e2e/ui-primitives-a11y.spec.ts 钉住。

                   **只有 z-index 不跟 React。** React 那边所有浮层都是 z-50，靠 portal
                   的 DOM 顺序决定谁在上；本仓有一套明写的层级约定（见
                   ui/dialog/DialogOverlay.vue 文件头）：portal 到 body 的浮层统一 z-80、
                   tooltip z-90、应用自身的 fixed 停在 z-50、toaster z-[120]。跟着 React
                   写 z-50，对话框里的 Select（AgentSettingsDialog 有三个）会被 z-80 的
                   对话框盖住。这一枚 token 保持本仓的约定，其余逐字照抄。
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

import SelectScrollDownButton from "./SelectScrollDownButton.vue";
import SelectScrollUpButton from "./SelectScrollUpButton.vue";
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
    position: "item-aligned",
    align: "center",
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
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-80 max-h-(--reka-select-content-available-height) min-w-[8rem] origin-(--reka-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md',
          props.position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          props.class,
        )
      "
      @escape-key-down="emits('escapeKeyDown', $event)"
      @pointer-down-outside="emits('pointerDownOutside', $event)"
      @close-auto-focus="emits('closeAutoFocus', $event)"
    >
      <SelectScrollUpButton />
      <SelectViewport
        :class="
          cn(
            'p-1',
            props.position === 'popper' &&
              'h-[var(--reka-select-trigger-height)] w-full min-w-[var(--reka-select-trigger-width)] scroll-my-1',
          )
        "
      >
        <slot />
      </SelectViewport>
      <SelectScrollDownButton />
    </SelectContent>
  </SelectPortal>
</template>
