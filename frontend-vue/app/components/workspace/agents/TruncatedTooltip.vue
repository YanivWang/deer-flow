<script setup lang="ts">
/*
  【文件职责】     只在内容**真被截断**时，把全文显示在 tooltip 里。
  【架构位置】     L3
  【主要导出】     默认 TruncatedTooltip 组件
  【依赖关系】     ui/tooltip L2 · AgentCard
  【边界与注意】   逐条对着上游 agent-card.tsx:53 的同名内部组件。

                   **为什么不无条件挂 tooltip**：agent 名与描述大多数时候一眼看得完，
                   那时再飘一层浮层是纯噪声；而一旦被 `truncate` / `line-clamp-2`
                   截掉，用户就**没有任何办法**看到全文——这两个字段都是用户自己填的，
                   长度不可控。上游的判据是 `scrollWidth > clientWidth ||
                   scrollHeight > clientHeight`，在 pointerenter 那一刻量，
                   而不是渲染时量：卡片宽度随容器变，渲染时量到的结果说了不算。

                   量的是**触发器自己**，所以它必须就是那个被截断的元素——
                   `TooltipTrigger` 默认 `as-child`，插槽里那一个元素会直接接手
                   事件与 ref，中间不能再包一层 div，包了就量到外层的尺寸。
*/
import { ref } from "vue";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

defineProps<{ text: string }>();
const truncated = ref(false);

function measure(event: PointerEvent) {
  const el = event.currentTarget as HTMLElement | null;
  if (!el) return;
  truncated.value =
    el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
}
</script>

<template>
  <Tooltip>
    <TooltipTrigger @pointerenter="measure">
      <slot />
    </TooltipTrigger>
    <TooltipContent v-if="truncated" class="max-w-xs text-wrap break-words">
      {{ text }}
    </TooltipContent>
  </Tooltip>
</template>
