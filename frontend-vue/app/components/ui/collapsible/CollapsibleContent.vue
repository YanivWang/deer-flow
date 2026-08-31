<!--
  【文件职责】     折叠容器的内容层。
  【架构位置】     L2
  【主要导出】     CollapsibleContent 组件
  【依赖关系】     reka-ui CollapsibleContent
  【边界与注意】   只转发 class：上游 `ui/collapsible.tsx` 的 CollapsibleContent 除了
                   data-slot 之外什么都不加，样式全由调用点给。
-->
<script setup lang="ts">
import { CollapsibleContent as CollapsibleContentPrimitive } from "reka-ui";

defineProps<{ class?: string }>();
</script>

<template>
  <CollapsibleContentPrimitive
    data-slot="collapsible-content"
    :class="$props.class"
  >
    <slot />
  </CollapsibleContentPrimitive>
</template>
