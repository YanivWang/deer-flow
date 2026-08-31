<!--
  【文件职责】     折叠容器的触发按钮。
  【架构位置】     L2
  【主要导出】     CollapsibleTrigger 组件
  【依赖关系】     reka-ui CollapsibleTrigger · @/lib/utils
  【边界与注意】   上游 `ui/collapsible.tsx` 的 CollapsibleTrigger 只加两样东西：
                   `data-slot` 与一句 `cursor-pointer`，其余样式全由调用点给。
                   `cursor-pointer` 排在**最前面**，这样调用点传 `cursor-default`
                   时能靠 cn() 的后来居上覆盖掉它——上游 ReasoningTrigger 的
                   `!hasContent && "cursor-default"` 就是这么工作的。

                   本仓此前没有这一颗，index.ts 里写着「只被 ChainOfThoughtHeader 用，
                   而那个组件本仓没有调用点」。ui/reasoning 是第二个调用点，
                   于是按上游那 11 行补上。
-->
<script setup lang="ts">
import { CollapsibleTrigger as CollapsibleTriggerPrimitive } from "reka-ui";
import { computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: string }>();

const classes = computed(() => cn("cursor-pointer", props.class));
</script>

<template>
  <CollapsibleTriggerPrimitive data-slot="collapsible-trigger" :class="classes">
    <slot />
  </CollapsibleTriggerPrimitive>
</template>
