<!--
  【文件职责】     DropdownMenu 子菜单的根。
  【架构位置】     L2
  【主要导出】     DropdownMenuSub 组件
  【依赖关系】     Reka DropdownMenuSub
  【边界与注意】   只负责开合状态；触发器与内容各自是独立的 primitive，
                   与顶层菜单同一套分工。
-->

<script setup lang="ts">
import {
  DropdownMenuSub,
  useForwardPropsEmits,
  type DropdownMenuSubEmits,
  type DropdownMenuSubProps,
} from "reka-ui";

const props = defineProps<DropdownMenuSubProps>();
const emits = defineEmits<DropdownMenuSubEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuSub data-slot="dropdown-menu-sub" v-bind="forwarded">
    <slot />
  </DropdownMenuSub>
</template>
