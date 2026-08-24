<!--
  【文件职责】     按用户偏好渲染 assistant turn 总量或 step-debug token usage。
  【架构位置】     L3 消息 UI adapter
  【主要导出】     默认 MessageTokenUsage 组件
  【依赖关系】     core/messages/usage · usage-model · i18n
  【边界与注意】   off 时不留 inline DOM；流式中不展示未完成的 debug attribution。
-->

<script setup lang="ts">
import { computed } from "vue";
import { Coins } from "lucide-vue-next";

import type { Message } from "@/core/types/message";
import { accumulateUsage, formatTokenCount } from "@/core/messages/usage";
import { buildTokenDebugSteps } from "@/core/messages/usage-model";

const props = defineProps<{
  messages: Message[];
  mode: "off" | "per_turn" | "step_debug";
  loading?: boolean;
}>();
const { $i18n } = useNuxtApp();
const usage = computed(() =>
  accumulateUsage(props.messages.filter((message) => message.type === "ai")),
);
const debugSteps = computed(() =>
  props.mode === "step_debug"
    ? buildTokenDebugSteps(props.messages, $i18n.t.value)
    : [],
);
</script>

<template>
  <div
    v-if="mode === 'per_turn' && usage"
    class="text-muted-foreground border-border mt-2 flex flex-wrap gap-3 border-t pt-2 text-[11px]"
    data-testid="message-token-usage"
  >
    <span class="flex items-center gap-1 font-medium"
      ><Coins :size="12" />{{ $i18n.t.value.tokenUsage.label }}</span
    >
    <span
      >{{ $i18n.t.value.tokenUsage.input }}:
      {{ formatTokenCount(usage.inputTokens) }}</span
    >
    <span
      >{{ $i18n.t.value.tokenUsage.output }}:
      {{ formatTokenCount(usage.outputTokens) }}</span
    >
    <span class="font-medium"
      >{{ $i18n.t.value.tokenUsage.total }}:
      {{ formatTokenCount(usage.totalTokens) }}</span
    >
  </div>
  <div
    v-else-if="mode === 'step_debug' && !loading && debugSteps.length"
    class="border-border mt-2 space-y-2 border-t pt-2"
    data-testid="message-token-debug"
  >
    <div
      v-for="step in debugSteps"
      :key="step.id"
      class="bg-muted/30 rounded-md border px-3 py-2 text-xs"
    >
      <div class="font-medium">{{ step.label }}</div>
      <div class="text-muted-foreground mt-1">
        {{
          step.usage
            ? `${formatTokenCount(step.usage.totalTokens)} ${$i18n.t.value.tokenUsage.label}`
            : $i18n.t.value.tokenUsage.unavailableShort
        }}
      </div>
    </div>
  </div>
</template>
