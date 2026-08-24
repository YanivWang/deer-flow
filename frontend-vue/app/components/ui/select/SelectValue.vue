<!--
  【文件职责】     Select 当前值文本。
  【架构位置】     L2
  【主要导出】     SelectValue 组件
  【依赖关系】     Reka SelectValue
  【边界与注意】   placeholder 是产品文案，由调用方传入。
-->

<script setup lang="ts">
import { SelectValue, type SelectValueProps, useForwardProps } from "reka-ui";

const props = defineProps<SelectValueProps>();
const forwarded = useForwardProps(props);
</script>

<template>
  <SelectValue data-slot="select-value" v-bind="forwarded">
    <slot />
  </SelectValue>
</template>
