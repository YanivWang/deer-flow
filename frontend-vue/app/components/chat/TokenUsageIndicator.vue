<!--
  【文件职责】     展示线程总 token、当前 context 占比并编辑 usage 视图偏好。
  【对应 frontend/】 components/workspace/token-usage-indicator.tsx
  【架构位置】     L3 workspace UI adapter
  【主要导出】     默认 TokenUsageIndicator 组件
  【依赖关系】     core/messages/usage · usage-model · core/threads/token-usage
  【边界与注意】   persisted snapshot 为基线，仅追加当前 active run 的 SSE usage。
-->

<script setup lang="ts">
import { computed } from "vue";
import { Coins } from "lucide-vue-next";

import type { Message } from "@/core/types/message";
import {
  formatTokenCount,
  selectHeaderTokenUsage,
  type TokenUsage,
} from "@/core/messages/usage";
import {
  getTokenUsageViewPreset,
  tokenUsagePreferencesFromPreset,
  type TokenUsagePreferences,
  type TokenUsageViewPreset,
} from "@/core/messages/usage-model";
import type { ContextUsage } from "@/core/threads/token-usage";

const props = withDefaults(
  defineProps<{
    threadId?: string | null;
    messages: Message[];
    pendingMessages?: Message[];
    backendUsage?: TokenUsage | null;
    contextUsage?: ContextUsage | null;
    enabled?: boolean;
    preferences: TokenUsagePreferences;
  }>(),
  {
    pendingMessages: () => [],
    backendUsage: null,
    contextUsage: null,
    enabled: false,
  },
);
const emit = defineEmits<{
  preferencesChange: [value: TokenUsagePreferences];
}>();
const { $i18n } = useNuxtApp();

const usage = computed(() =>
  selectHeaderTokenUsage({
    backendUsage: props.threadId ? props.backendUsage : null,
    messages: props.messages,
    pendingMessages: props.pendingMessages,
  }),
);
const preset = computed(() => getTokenUsageViewPreset(props.preferences));
const percentage = computed(() => {
  const value = props.contextUsage?.percentage;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value)).toFixed(1)
    : null;
});
const presets: TokenUsageViewPreset[] = ["off", "summary", "per_turn", "debug"];

function updatePreset(event: Event) {
  emit(
    "preferencesChange",
    tokenUsagePreferencesFromPreset(
      (event.target as HTMLSelectElement).value as TokenUsageViewPreset,
    ),
  );
}
function presetLabel(value: TokenUsageViewPreset) {
  const key = value === "per_turn" ? "perTurn" : value;
  return $i18n.t.value.tokenUsage.presets[key];
}
</script>

<template>
  <details
    v-if="enabled"
    class="border-border bg-background/80 text-muted-foreground relative rounded-full border text-xs"
    data-testid="token-usage-indicator"
  >
    <summary
      class="flex cursor-pointer list-none items-center gap-1.5 px-2 py-1 [&::-webkit-details-marker]:hidden"
    >
      <Coins :size="14" />
      <span>{{ $i18n.t.value.tokenUsage.label }}</span>
      <span class="font-mono">
        {{
          preferences.headerTotal
            ? usage
              ? formatTokenCount(usage.totalTokens)
              : "-"
            : presetLabel(preset)
        }}
      </span>
      <span v-if="percentage" class="border-l pl-1.5 font-mono"
        >{{ percentage }}%</span
      >
    </summary>
    <div
      class="border-border bg-background absolute top-full right-0 mt-1 w-72 rounded-lg border p-3 shadow-lg"
    >
      <dl v-if="usage" class="grid grid-cols-[1fr_auto] gap-1 text-xs">
        <dt>{{ $i18n.t.value.tokenUsage.input }}</dt>
        <dd class="font-mono">{{ formatTokenCount(usage.inputTokens) }}</dd>
        <dt>{{ $i18n.t.value.tokenUsage.output }}</dt>
        <dd class="font-mono">{{ formatTokenCount(usage.outputTokens) }}</dd>
        <dt class="font-medium">{{ $i18n.t.value.tokenUsage.total }}</dt>
        <dd class="font-mono font-medium">
          {{ formatTokenCount(usage.totalTokens) }}
        </dd>
      </dl>
      <p v-else class="text-muted-foreground text-xs">
        {{ $i18n.t.value.tokenUsage.unavailable }}
      </p>
      <label class="mt-3 block text-xs">
        <span class="mb-1 block">{{ $i18n.t.value.tokenUsage.view }}</span>
        <select
          class="border-input w-full rounded-md border px-2 py-1"
          :value="preset"
          @change="updatePreset"
        >
          <option v-for="value in presets" :key="value" :value="value">
            {{ presetLabel(value) }}
          </option>
        </select>
      </label>
      <p class="text-muted-foreground mt-2 text-[11px] leading-relaxed">
        {{ $i18n.t.value.tokenUsage.note }}
      </p>
    </div>
  </details>
</template>
