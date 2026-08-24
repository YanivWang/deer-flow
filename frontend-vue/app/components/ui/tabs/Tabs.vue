<!--
  【文件职责】     Tabs 根：当前面板值与方向。
  【架构位置】     L2
  【主要导出】     Tabs 组件
  【依赖关系】     Reka TabsRoot
  【边界与注意】   tablist 里方向键移动、Tab 键整体进出，这是它区别于一排按钮的地方。
-->

<script setup lang="ts">
import {
  TabsRoot,
  useForwardPropsEmits,
  type TabsRootEmits,
  type TabsRootProps,
} from "reka-ui";

const props = defineProps<TabsRootProps>();
const emits = defineEmits<TabsRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <TabsRoot data-slot="tabs" v-bind="forwarded">
    <slot />
  </TabsRoot>
</template>
