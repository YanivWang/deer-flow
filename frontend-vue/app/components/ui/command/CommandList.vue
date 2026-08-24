<!--
  【文件职责】     Command 的 listbox 容器。
  【架构位置】     L2
  【主要导出】     CommandList 组件
  【依赖关系】     Reka ListboxContent · cn
  【边界与注意】   可访问名字由调用方通过 aria-label 提供。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  ListboxContent,
  type ListboxContentProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  ListboxContentProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <ListboxContent
    data-slot="command-list"
    v-bind="delegated"
    :class="
      cn(
        'max-h-80 overflow-x-hidden overflow-y-auto p-2 outline-none',
        props.class,
      )
    "
  >
    <slot />
  </ListboxContent>
</template>
