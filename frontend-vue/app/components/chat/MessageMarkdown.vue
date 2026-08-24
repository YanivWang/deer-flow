<script setup lang="ts">
/*
  【文件职责】     聊天消息 Markdown 的唯一产品适配器：安全预处理、插件链、流式状态与组件覆盖。
  【对应 frontend/】 components/workspace/messages/markdown-content.tsx
  【架构位置】     L3 chat UI adapter
  【主要导出】     默认 MessageMarkdown 组件
  【依赖关系】     StreamMarkdown · core/markdown/{safe-markdown,plugins}
  【边界与注意】   StreamMarkdown 保持框架级渲染器；所有消息、推理和工具步骤都必须经过本层，
                   避免调用点漏传 GFM/math/streaming 插件后产生静默的产品差异。
*/
import { computed, defineAsyncComponent, provide } from "vue";

import {
  appRehypePlugins,
  appRemarkPlugins,
  rehypeStreamingListItems,
} from "@/core/markdown/plugins";
import { getSafeMarkdown } from "@/core/markdown/safe-markdown";
import { markdownStreamingKey } from "@/core/markdown/rendering-context";

import type { PluggableList } from "unified";

const StreamMarkdown = defineAsyncComponent(
  () => import("@/components/markdown/StreamMarkdown.vue"),
);

const props = withDefaults(
  defineProps<{
    content: string;
    streaming?: boolean;
    components?: Record<string, unknown>;
    remarkPlugins?: PluggableList;
    rehypePlugins?: PluggableList;
  }>(),
  { streaming: false },
);

const effectiveRemarkPlugins = computed(
  () => props.remarkPlugins ?? appRemarkPlugins,
);
const effectiveRehypePlugins = computed<PluggableList>(() => [
  ...appRehypePlugins,
  ...(props.rehypePlugins ?? []),
  ...(props.streaming ? [rehypeStreamingListItems] : []),
]);
provide(
  markdownStreamingKey,
  computed(() => props.streaming),
);
</script>

<template>
  <StreamMarkdown
    :content="getSafeMarkdown(content)"
    :components="components"
    :remark-plugins="effectiveRemarkPlugins"
    :rehype-plugins="effectiveRehypePlugins"
    :parse-incomplete-markdown="streaming"
    :animated="streaming"
    new-word-class="animate-in fade-in duration-200"
  />
</template>
