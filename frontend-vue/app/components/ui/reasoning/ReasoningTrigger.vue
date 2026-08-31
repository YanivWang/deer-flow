<!--
  【文件职责】     推理披露的触发行（上游 `ai-elements/reasoning.tsx:176` 的 ReasoningTrigger）。
  【架构位置】     L2 —— 通用 UI primitive
  【主要导出】     ReasoningTrigger 组件
  【依赖关系】     ../collapsible/CollapsibleTrigger.vue · ./context · @/lib/utils · lucide-vue-next
  【边界与注意】   ① **文案由调用点从默认插槽传进来，primitive 自己不产生任何文字。**
                   上游有一条 `defaultGetThinkingMessage` 默认链（"Thinking..." /
                   "Thought for a few seconds" / "Thought for N seconds" / 带
                   `({elapsed}s)` 的 LiveTimer），但**唯一的调用点把它整条覆盖掉了**
                   （message-list-item.tsx:393 的 getReasoningMessage 只返回
                   `t.runDuration.reasoning`，流式时套一层 Shimmer）。移植那条链
                   等于往 L2 里塞四句永远不会被渲染的英文常量，而 i18n source guard
                   把 ui/ 也算在扫描面内——primitive 不许持有产品文案。
                   真要用时按上游那 16 行补，并让调用点传 label。

                   ② 图标写 `class="size-4"` 而不是 `:size="16"`，与上游
                   `<BrainIcon className="size-4" />` 同一条机制（CSS 覆盖 svg 的
                   width/height 表现属性）。此前本仓写 `:size="16"`，渲染出来一样是
                   16px，但机制不同。

                   ③ 箭头的旋转档走**一个** `cn()` 的 computed。此前是 `class` 与
                   `:class` 两个属性各写一半，渲染出来的 class 串里
                   `transition-transform rotate-180` 会出现两遍（probe 实测），
                   而「某状态下换掉一个 Tailwind 类」这种写法的赢家由样式表顺序
                   决定，不由模板顺序决定（坑 55）。

                   ④ 上游的 `hasContent`（false 时加 `cursor-default`、不画箭头）
                   没有移植：唯一的调用点包在 `v-if="reasoning(message)"` 里，
                   永远有内容。判据同 ui/collapsible——缺的是需求不是能力。
-->

<script setup lang="ts">
import { BrainIcon, ChevronDownIcon } from "lucide-vue-next";
import { computed } from "vue";

import { cn } from "@/lib/utils";

import CollapsibleTrigger from "../collapsible/CollapsibleTrigger.vue";
import { injectReasoning } from "./context";

const props = defineProps<{ class?: string }>();

const { isOpen } = injectReasoning();

const classes = computed(() =>
  cn(
    "text-muted-foreground hover:text-foreground flex w-full items-center gap-2 text-sm transition-colors",
    props.class,
  ),
);
const chevronClasses = computed(() =>
  cn("size-4 transition-transform", isOpen.value ? "rotate-180" : "rotate-0"),
);
</script>

<template>
  <CollapsibleTrigger :class="classes">
    <BrainIcon class="size-4" />
    <slot />
    <ChevronDownIcon :class="chevronClasses" />
  </CollapsibleTrigger>
</template>
