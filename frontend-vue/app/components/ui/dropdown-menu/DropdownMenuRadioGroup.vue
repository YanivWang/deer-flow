<!--
  【文件职责】     DropdownMenu 单选组。
  【架构位置】     L2
  【主要导出】     DropdownMenuRadioGroup 组件
  【依赖关系】     Reka DropdownMenuRadioGroup
  【边界与注意】   只承载 v-model，不做样式。
-->

<script setup lang="ts">
import {
  DropdownMenuRadioGroup,
  useForwardPropsEmits,
  type DropdownMenuRadioGroupEmits,
  type DropdownMenuRadioGroupProps,
} from "reka-ui";

const props = defineProps<DropdownMenuRadioGroupProps>();
const emits = defineEmits<DropdownMenuRadioGroupEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuRadioGroup
    data-slot="dropdown-menu-radio-group"
    v-bind="forwarded"
  >
    <slot />
  </DropdownMenuRadioGroup>
</template>
