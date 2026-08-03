<script setup lang="ts">
const props = defineProps<{
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}>();

const { t } = useAppI18n();

function formatTokenCount(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 1 : 1).replace(/\.0$/, "")}K`;
  return String(value);
}
</script>

<template>
  <details class="workspace-chat__token-indicator">
    <summary>
      <span aria-hidden="true">◉</span>
      <span>{{ t("tokenUsage.label") }}</span>
      <span>{{ formatTokenCount(props.totalTokens) }}</span>
      <span>⌄</span>
    </summary>
    <div class="workspace-chat__token-popover">
      <strong>{{ t("tokenUsage.title") }}</strong>
      <p v-if="props.totalTokens === null">{{ t("tokenUsage.unavailable") }}</p>
      <dl v-else>
        <div><dt>输入</dt><dd>{{ formatTokenCount(props.inputTokens) }}</dd></div>
        <div><dt>输出</dt><dd>{{ formatTokenCount(props.outputTokens) }}</dd></div>
        <div><dt>总计</dt><dd>{{ formatTokenCount(props.totalTokens) }}</dd></div>
      </dl>
    </div>
  </details>
</template>
