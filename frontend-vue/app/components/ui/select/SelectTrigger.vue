<!--
  【文件职责】     Select 触发器：显示当前值并承载 combobox 语义。
  【架构位置】     L2
  【主要导出】     SelectTrigger 组件
  【依赖关系】     Reka SelectTrigger/SelectIcon · cn
  【边界与注意】   可访问名字由调用方通过 aria-label 或关联 label 提供。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  SelectIcon,
  SelectTrigger,
  type SelectTriggerProps,
  useForwardProps,
} from "reka-ui";
import { ChevronDown } from "lucide-vue-next";

import { cn } from "@/lib/utils";

const props = defineProps<
  SelectTriggerProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <SelectTrigger
    data-slot="select-trigger"
    v-bind="delegated"
    :class="
      cn(
        'border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm whitespace-nowrap outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate',
        props.class,
      )
    "
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDown class="size-4 shrink-0 opacity-50" aria-hidden="true" />
    </SelectIcon>
  </SelectTrigger>
</template>
