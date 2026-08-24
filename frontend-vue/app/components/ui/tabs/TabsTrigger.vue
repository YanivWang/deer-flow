<!--
  【文件职责】     单个 tab 触发器。
  【架构位置】     L2
  【主要导出】     TabsTrigger 组件
  【依赖关系】     Reka TabsTrigger · cn
  【边界与注意】   选中态用 data-[state=active]，不要再自己维护一份 class 判断。
-->

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { TabsTrigger, type TabsTriggerProps, useForwardProps } from "reka-ui";

import { cn } from "@/lib/utils";

const props = defineProps<
  TabsTriggerProps & { class?: HTMLAttributes["class"] }
>();
const forwarded = useForwardProps(props);
const delegated = computed(() => {
  const { class: _class, ...rest } = forwarded.value;
  void _class;
  return rest;
});
</script>

<template>
  <TabsTrigger
    data-slot="tabs-trigger"
    v-bind="delegated"
    :class="
      cn(
        'focus-visible:ring-ring/50 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground cursor-pointer rounded-md border px-3 py-1.5 text-sm outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50',
        props.class,
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
