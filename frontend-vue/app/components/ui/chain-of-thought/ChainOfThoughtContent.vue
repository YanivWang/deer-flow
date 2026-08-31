<!--
  【文件职责】     思维链的可折叠内容层。
  【架构位置】     L2
  【主要导出】     ChainOfThoughtContent 组件
  【依赖关系】     ../collapsible · ./context · @/lib/utils
  【边界与注意】   展开状态来自 ChainOfThought 的 provide，不自己持有：上游同样是从
                   context 读 isOpen，把 Collapsible 当纯展示壳用（没有 trigger）。

                   透传下来的 `id`（调用点用它做 aria-controls 的目标）落在
                   **Collapsible 根**上，不是内容元素上：reka 的 CollapsibleContent
                   写的是 `mergeProps($attrs, { id: rootContext.contentId })`，
                   自己的 id 排在后面会覆盖透传的；radix 那边顺序相反，所以上游的
                   id 落在内容元素上。两者都是包着面板的容器，aria-controls 指向
                   哪一个都成立，可访问性树也不报 id，所以不为此再包一层。
-->
<script setup lang="ts">
import { computed } from "vue";

import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import { injectChainOfThought } from "./context";

const props = defineProps<{ class?: string }>();

const { isOpen } = injectChainOfThought();

const classes = computed(() =>
  cn(
    "mt-2 space-y-3",
    "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in outline-none",
    props.class,
  ),
);
</script>

<template>
  <Collapsible :open="isOpen">
    <CollapsibleContent :class="classes">
      <slot />
    </CollapsibleContent>
  </Collapsible>
</template>
