<!--
  【文件职责】     Select 根：单选列表框的值与开合状态。
  【架构位置】     L2
  【主要导出】     Select 组件
  【依赖关系】     Reka SelectRoot
  【边界与注意】   触发器是 combobox、选项是 option；方向键、Home/End、首字母跳转
                   由 Reka 实现，调用方不要再自己监听键盘。
-->

<script setup lang="ts">
import {
  SelectRoot,
  useForwardPropsEmits,
  type SelectRootEmits,
  type SelectRootProps,
} from "reka-ui";

const props = defineProps<SelectRootProps>();
const emits = defineEmits<SelectRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SelectRoot data-slot="select" v-bind="forwarded">
    <slot />
  </SelectRoot>
</template>
