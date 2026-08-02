<script setup lang="ts">
const { t } = useAppI18n();
</script>

<template>
  <details class="workspace-chat__token-indicator">
    <summary>
      <span>◉</span>
      <span>{{ t("tokenUsage.label") }}</span>
      <span>—</span>
      <span>⌄</span>
    </summary>
    <div class="workspace-chat__token-popover">
      <strong>{{ t("tokenUsage.title") }}</strong>
      <p>{{ t("tokenUsage.unavailable") }}</p>
    </div>
  </details>
</template>
