<!--
  【文件职责】     推理披露的内容层（上游 `ai-elements/reasoning.tsx:220` 的 ReasoningContent）。
  【架构位置】     L2 —— 通用 UI primitive
  【主要导出】     ReasoningContent 组件
  【依赖关系】     ../collapsible/CollapsibleContent.vue · @/lib/utils
  【边界与注意】   **这一层就是 streaming-reasoning-order 那条几何差异的全部来源。**
                   wave 14 用 probe 把两边逐个盒子量下来：

                     React  trigger 20 + mt-4 16 + 内容 20（text-sm 自带 lh 20px）= 56
                     Vue    trigger 20 + mt-2  8 + 内容 22.8（leading-relaxed）    = 50.7

                   Δ = (8 − 16) + (22.75 − 20) = −8 + 2.75 = −5.25，实测台账 −5.3。
                   两处**方向相反**、部分互相抵消，所以只改一处会把差异放大而不是
                   缩小——这也是为什么先量再改：单看 `mt-2` 会以为差 8px。

                   所以这里逐字照抄上游的 `mt-4 text-sm` 与那串动画类，**不加
                   `leading-relaxed`**：text-sm 自带的 `line-height: 1.25rem` 才是
                   上游的行高。

                   `size-full` 上游这一层没有、本仓 StreamMarkdown 默认带着。
                   它是 `width:100%;height:100%`：块级元素本来就满宽，父级高度 auto
                   时 height:100% 解析成 auto，probe 实测两边盒子相等，故不动它——
                   那是渲染器的默认值，与正文那条路径共用。
-->

<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

import CollapsibleContent from "../collapsible/CollapsibleContent.vue";

const props = defineProps<{ class?: string }>();

const classes = computed(() =>
  cn(
    "mt-4 text-sm",
    "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground data-[state=closed]:animate-out data-[state=open]:animate-in outline-none",
    props.class,
  ),
);
</script>

<template>
  <CollapsibleContent :class="classes">
    <slot />
  </CollapsibleContent>
</template>
