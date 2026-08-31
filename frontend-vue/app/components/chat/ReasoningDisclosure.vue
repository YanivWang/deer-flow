<script setup lang="ts">
/*
  【文件职责】     把 assistant 的 reasoning 接到 Reasoning primitive 上：文案、Shimmer 与 markdown。
  【架构位置】     L3 chat UI adapter
  【主要导出】     默认 ReasoningDisclosure 组件
  【依赖关系】     ui/reasoning · ui/effects/Shimmer · MessageMarkdown
  【边界与注意】   本文件此前是一份**手搓的**披露组件：自己写 `<div class="not-prose mb-4">`
                   + `<button>` + `v-if`，把上游 `ai-elements/reasoning.tsx` 那三个
                   primitive 的活全干了。代价是三样东西同时对不上——内容层的
                   `mt-2` 与 `leading-relaxed`（几何差异的来源，见 ReasoningContent.vue）、
                   三个 `data-slot`、以及流式时的 Shimmer。与 wave 13 的
                   SidebarTrigger 是同一个模式：上游是 primitive，本仓抄成了手写代码。

                   这一层保留的只有**调用点该管的事**：上游
                   `message-list-item.tsx:393` 的 getReasoningMessage——流式时
                   `<Shimmer duration={1}>`，否则一段裸文字。裸文字不套 `<span>`：
                   上游那个分支返回的是字符串本身，套一层会在两边的树上多出一个盒子。
*/
import Shimmer from "@/components/ui/effects/Shimmer.vue";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ui/reasoning";
import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";

const props = defineProps<{
  content: string;
  streaming: boolean;
  markdownComponents?: Record<string, unknown>;
}>();
const { $i18n } = useNuxtApp();
</script>

<template>
  <Reasoning :is-streaming="props.streaming">
    <ReasoningTrigger>
      <Shimmer
        v-if="props.streaming"
        :text="$i18n.t.value.runDuration.reasoning"
        :duration="1"
      />
      <template v-else>{{ $i18n.t.value.runDuration.reasoning }}</template>
    </ReasoningTrigger>
    <ReasoningContent>
      <MessageMarkdown
        :content="props.content"
        :components="props.markdownComponents"
        :streaming="props.streaming"
      />
    </ReasoningContent>
  </Reasoning>
</template>
