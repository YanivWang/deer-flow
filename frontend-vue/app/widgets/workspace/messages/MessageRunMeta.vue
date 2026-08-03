<script setup lang="ts">
import { Clock3, Coins } from "lucide-vue-next";

const props = defineProps<{
  duration: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  visible: boolean;
}>();

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining === 0 ? `${minutes} 分` : `${minutes} 分 ${remaining} 秒`;
}

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${trimDecimal(value / 1_000_000)}M`;
  if (value >= 1_000) return `${trimDecimal(value / 1_000)}K`;
  return String(value);
}

function trimDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}
</script>

<template>
  <div v-if="props.visible && (props.duration !== null || props.totalTokens !== null && props.totalTokens !== undefined)" class="message-list__run-meta">
    <div v-if="props.totalTokens !== null && props.totalTokens !== undefined" class="message-list__token-usage">
      <span><Coins :size="14" aria-hidden="true" /> Tokens</span>
      <span>输入: {{ formatTokenCount(props.inputTokens ?? 0) }}</span>
      <span>输出: {{ formatTokenCount(props.outputTokens ?? 0) }}</span>
      <span>总计: {{ formatTokenCount(props.totalTokens) }}</span>
    </div>
    <div v-if="props.duration !== null" class="message-list__run-duration" data-testid="run-duration">
      <Clock3 :size="16" aria-hidden="true" />
      本次任务耗时 {{ formatDuration(props.duration) }}
    </div>
  </div>
</template>
