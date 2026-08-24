<!--
  【文件职责】     Command 单个可执行项。
  【架构位置】     L2
  【主要导出】     CommandItem 组件
  【依赖关系】     Reka ListboxItem · cn
  【边界与注意】   高亮态用 data-highlighted，不要再自己维护 aria-selected。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  ListboxItem,
  type ListboxItemEmits,
  type ListboxItemProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  ListboxItemProps & { class?: HTMLAttributes["class"] }
>();
const emits = defineEmits<ListboxItemEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <ListboxItem
    data-slot="command-item"
    v-bind="delegated"
    :class="
      cn(
        'data-[highlighted]:bg-accent flex w-full cursor-default items-center gap-3 rounded-md px-3 py-2 text-left text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.class,
      )
    "
    @select="emits('select', $event)"
  >
    <slot />
  </ListboxItem>
</template>
