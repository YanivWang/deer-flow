<!--
  【文件职责】     Select 列表顶部的滚动指示按钮。
  【架构位置】     L2
  【主要导出】     SelectScrollUpButton 组件
  【依赖关系】     Reka SelectScrollUpButton · cn
  【边界与注意】   选项多到需要滚动时 Reka 才渲染它，与 React 的同名件一一对应
                   （frontend/src/components/ui/select.tsx）。它是装饰性的、
                   `aria-hidden`，所以可访问性树上看不见——对照台账因此报不出它缺席，
                   只有真的展开列表才会发现少了一个可点的滚动入口。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  SelectScrollUpButton,
  type SelectScrollUpButtonProps,
  useForwardProps,
} from "reka-ui";
import { ChevronUp } from "lucide-vue-next";

import { cn } from "@/lib/utils";

const props = defineProps<
  SelectScrollUpButtonProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <SelectScrollUpButton
    data-slot="select-scroll-up-button"
    v-bind="delegated"
    :class="
      cn('flex cursor-default items-center justify-center py-1', props.class)
    "
  >
    <ChevronUp class="size-4" />
  </SelectScrollUpButton>
</template>
