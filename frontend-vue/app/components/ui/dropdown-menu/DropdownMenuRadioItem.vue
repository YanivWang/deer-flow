<!--
  【文件职责】     DropdownMenu 单选项，自带选中指示位。
  【架构位置】     L2
  【主要导出】     DropdownMenuRadioItem 组件
  【依赖关系】     Reka DropdownMenuRadioItem/ItemIndicator · cn
  【边界与注意】   指示位固定占位，选中与否都不改变文本起点。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import {
  DropdownMenuItemIndicator,
  DropdownMenuRadioItem,
  type DropdownMenuRadioItemEmits,
  type DropdownMenuRadioItemProps,
  useForwardProps,
} from "reka-ui";
import { Check } from "lucide-vue-next";

import { cn } from "@/lib/utils";

const props = defineProps<
  DropdownMenuRadioItemProps & { class?: HTMLAttributes["class"] }
>();
const emits = defineEmits<DropdownMenuRadioItemEmits>();

const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <DropdownMenuRadioItem
    data-slot="dropdown-menu-radio-item"
    v-bind="delegated"
    :class="
      cn(
        'hover:bg-accent focus:bg-accent relative flex w-full cursor-default items-center gap-2 rounded py-1.5 pr-2 pl-7 text-left outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.class,
      )
    "
    @select="emits('select', $event)"
  >
    <span
      class="pointer-events-none absolute left-1.5 flex size-4 items-center justify-center"
    >
      <DropdownMenuItemIndicator>
        <Check :size="14" aria-hidden="true" />
      </DropdownMenuItemIndicator>
    </span>
    <slot />
  </DropdownMenuRadioItem>
</template>
