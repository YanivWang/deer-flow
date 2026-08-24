<script setup lang="ts">
/*
  【文件职责】     按 React 的可观察顺序渲染 processing 消息组，收敛推理、工具与结果 UI。
  【架构位置】     L3 UI adapter
  【主要导出】     默认 ProcessingMessageGroup 组件
  【依赖关系】     core/messages/processing · StreamMarkdown · ProcessingToolStep
  【边界与注意】   模板只消费纯视图模型；不得逐条渲染原始 ToolMessage 或重复关联结果。
*/
import { computed, ref } from "vue";
import {
  ChevronUp,
  Circle,
  Lightbulb,
  MessageSquareText,
} from "lucide-vue-next";

import ProcessingToolStep from "@/components/chat/ProcessingToolStep.vue";
import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";
import {
  deriveProcessingMessageView,
  type BrowserViewMeta,
  type ProcessingStep,
} from "@/core/messages/processing";
import type { Message } from "@/core/types/message";

const props = defineProps<{
  messages: Message[];
  streaming: boolean;
  threadId?: string | null;
  isMock?: boolean;
  markdownComponents?: Record<string, unknown>;
}>();
const emit = defineEmits<{
  artifact: [path: string];
  browser: [frame: BrowserViewMeta];
}>();
const { $i18n } = useNuxtApp();
const showEarlierSteps = ref(false);
const showTrailingReasoning = ref(false);
const view = computed(() => deriveProcessingMessageView(props.messages));

function visibleEarlierSteps(): readonly ProcessingStep[] {
  if (!view.value.lastToolCall)
    return view.value.visibleBeforeTrailingReasoning;
  return showEarlierSteps.value
    ? view.value.earlierSteps
    : view.value.alwaysVisibleEarlierText;
}
</script>

<template>
  <div
    data-testid="processing-message-group"
    class="not-prose w-full gap-2 rounded-lg border p-0.5"
  >
    <button
      v-if="view.collapsibleSteps.length"
      data-testid="toggle-earlier-steps"
      type="button"
      class="hover:bg-accent flex w-full items-start justify-start rounded-md px-4 py-2 text-left"
      :aria-expanded="showEarlierSteps"
      @click="showEarlierSteps = !showEarlierSteps"
    >
      <div class="text-muted-foreground flex w-full gap-2 text-sm opacity-60">
        <ChevronUp
          :size="16"
          class="mt-0.5 transition-transform duration-200"
          :class="showEarlierSteps ? 'rotate-180' : ''"
        />
        <span>
          {{
            showEarlierSteps
              ? $i18n.t.value.toolCalls.lessSteps
              : $i18n.t.value.toolCalls.moreSteps(view.collapsibleSteps.length)
          }}
        </span>
      </div>
    </button>

    <div
      v-if="visibleEarlierSteps().length || view.lastToolCall"
      class="text-popover-foreground mt-2 space-y-3 px-4 pb-2"
    >
      <template v-for="step in visibleEarlierSteps()" :key="step.id">
        <div
          v-if="step.type === 'assistantText'"
          class="text-muted-foreground flex gap-2 text-sm"
        >
          <MessageSquareText :size="16" class="mt-0.5 shrink-0" />
          <MessageMarkdown
            :content="step.content"
            :components="markdownComponents"
            :streaming="streaming"
            class="min-w-0 flex-1"
          />
        </div>
        <div
          v-else-if="step.type === 'reasoning'"
          class="text-muted-foreground flex gap-2 text-sm"
        >
          <Circle :size="16" class="mt-0.5 shrink-0" />
          <MessageMarkdown
            :content="step.reasoning"
            :components="markdownComponents"
            :streaming="streaming"
            class="min-w-0 flex-1"
          />
        </div>
        <ProcessingToolStep
          v-else
          :step="step"
          :thread-id="threadId"
          :is-mock="isMock"
          @artifact="emit('artifact', $event)"
          @browser="emit('browser', $event)"
        />
      </template>

      <ProcessingToolStep
        v-if="view.lastToolCall"
        :key="view.lastToolCall.id"
        :step="view.lastToolCall"
        :thread-id="threadId"
        :is-mock="isMock"
        @artifact="emit('artifact', $event)"
        @browser="emit('browser', $event)"
      />

      <div
        v-for="step in view.textAfterLastToolBeforeReasoning"
        :key="step.id"
        class="text-muted-foreground flex gap-2 text-sm"
      >
        <MessageSquareText :size="16" class="mt-0.5 shrink-0" />
        <MessageMarkdown
          :content="step.content"
          :components="markdownComponents"
          :streaming="streaming"
          class="min-w-0 flex-1"
        />
      </div>
    </div>

    <template v-if="view.trailingReasoning">
      <button
        data-testid="toggle-trailing-reasoning"
        type="button"
        class="hover:bg-accent flex w-full items-start justify-start rounded-md px-4 py-2 text-left"
        :aria-expanded="showTrailingReasoning"
        @click="showTrailingReasoning = !showTrailingReasoning"
      >
        <div
          class="text-muted-foreground flex w-full items-center justify-between gap-2 text-sm"
        >
          <span class="flex items-center gap-2">
            <Lightbulb :size="16" />
            {{ $i18n.t.value.common.thinking }}
          </span>
          <ChevronUp
            :size="16"
            :class="showTrailingReasoning ? '' : 'rotate-180'"
          />
        </div>
      </button>
      <div
        v-if="showTrailingReasoning"
        class="text-popover-foreground mt-2 space-y-3 px-4 pb-2"
      >
        <div class="text-muted-foreground flex gap-2 text-sm">
          <Circle :size="16" class="mt-0.5 shrink-0" />
          <MessageMarkdown
            :content="view.trailingReasoning.reasoning"
            :components="markdownComponents"
            :streaming="streaming"
            class="min-w-0 flex-1"
          />
        </div>
      </div>
    </template>

    <div
      v-if="view.answerAfterReasoning.length"
      class="text-popover-foreground mt-2 space-y-3 px-4 pb-2"
    >
      <div
        v-for="step in view.answerAfterReasoning"
        :key="step.id"
        class="text-muted-foreground flex gap-2 text-sm"
      >
        <MessageSquareText :size="16" class="mt-0.5 shrink-0" />
        <MessageMarkdown
          :content="step.content"
          :components="markdownComponents"
          :streaming="streaming"
          class="min-w-0 flex-1"
        />
      </div>
    </div>
  </div>
</template>
