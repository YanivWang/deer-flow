<!--
  【文件职责】     Select 选项分组。
  【架构位置】     L2
  【主要导出】     SelectGroup 组件
  【依赖关系】     Reka SelectGroup
  【边界与注意】   与 React 的同名件一一对应，只透传，不加样式。
-->

<script setup lang="ts">
import { SelectGroup, type SelectGroupProps, useForwardProps } from "reka-ui";

const props = defineProps<SelectGroupProps>();
const forwarded = useForwardProps(props);
</script>

<template>
  <SelectGroup data-slot="select-group" v-bind="forwarded">
    <slot />
  </SelectGroup>
</template>
