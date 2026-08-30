<!--
  【文件职责】     设置面板里每一节的标题、描述与正文骨架。
  【架构位置】     L3 workspace settings
  【主要导出】     默认 SettingsSection 组件
  【依赖关系】     cn
  【边界与注意】   逐行对照 React frontend/src/components/workspace/settings/settings-section.tsx。
                   标题是 div 而不是 heading：设置对话框里九个面板各有若干节，
                   把它们全变成 heading 会在一个 dialog 里造出一棵与 React 不同的
                   文档大纲。description 允许放插槽（notification 那节要塞一个 Switch）。
                   正文的 <main> 由这里给，settings 外壳不再自己包一层——
                   两边各一个 main 是对照判据。
-->

<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
  title?: string;
  description?: string;
}>();
</script>

<template>
  <section :class="cn(props.class)">
    <header class="space-y-2">
      <div class="text-lg font-semibold">
        <slot name="title">{{ props.title }}</slot>
      </div>
      <div
        v-if="$slots.description || props.description"
        class="text-muted-foreground text-sm"
      >
        <slot name="description">{{ props.description }}</slot>
      </div>
    </header>
    <main class="mt-4"><slot /></main>
  </section>
</template>
