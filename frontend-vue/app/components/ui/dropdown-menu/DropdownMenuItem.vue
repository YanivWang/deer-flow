<!--
  【文件职责】     DropdownMenu 单个动作项。
  【架构位置】     L2
  【主要导出】     DropdownMenuItem 组件
  【依赖关系】     Reka DropdownMenuItem · cn
  【边界与注意】   用 @select 而不是 @click：键盘 Enter/Space 只触发 select。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DropdownMenuItem,
  type DropdownMenuItemEmits,
  type DropdownMenuItemProps,
  useForwardProps,
} from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  DropdownMenuItemProps & {
    class?: HTMLAttributes["class"];
    variant?: "default" | "destructive";
  }
>();
const emits = defineEmits<DropdownMenuItemEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, variant: _variant, ...rest } = forwarded.value;
  void _class;
  void _variant;
  return rest;
});
</script>

<template>
  <DropdownMenuItem
    data-slot="dropdown-menu-item"
    :data-variant="props.variant"
    v-bind="delegated"
    :class="
      cn(
        'hover:bg-accent focus:bg-accent data-[variant=destructive]:text-destructive flex w-full cursor-default items-center gap-2 rounded px-2 py-1.5 text-left outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.class,
      )
    "
    @select="emits('select', $event)"
  >
    <slot />
  </DropdownMenuItem>
</template>
