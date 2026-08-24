<!--
  【文件职责】     Tabs 的 tablist 容器。
  【架构位置】     L2
  【主要导出】     TabsList 组件
  【依赖关系】     Reka TabsList · cn
  【边界与注意】   只放 TabsTrigger，别混入普通按钮。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { TabsList, type TabsListProps, useForwardProps } from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  TabsListProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <TabsList
    data-slot="tabs-list"
    v-bind="delegated"
    :class="cn('inline-flex w-fit items-center gap-2', props.class)"
  >
    <slot />
  </TabsList>
</template>
