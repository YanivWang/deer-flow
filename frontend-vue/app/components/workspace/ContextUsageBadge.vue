<script setup lang="ts">
import { computed } from "vue";
import { Gauge } from "lucide-vue-next";

import type { ContextUsage } from "@/core/threads/token-usage";

const props = defineProps<{
  contextUsage: ContextUsage | null;
}>();
const { $i18n } = useNuxtApp();

const formatted = computed(() => {
  const percentage = props.contextUsage?.percentage;
  if (typeof percentage !== "number" || !Number.isFinite(percentage)) {
    return null;
  }
  const clamped = Math.max(0, percentage);
  return Number.isInteger(clamped) ? `${clamped}` : clamped.toFixed(1);
});
</script>

<template>
  <div
    v-if="formatted === null"
    data-context-usage-placeholder="true"
    :aria-label="$i18n.t.value.contextUsage.title"
    :title="$i18n.t.value.contextUsage.title"
    class="text-muted-foreground bg-background/70 flex size-7 shrink-0 items-center justify-center rounded-full border"
  >
    <Gauge :size="14" />
  </div>
  <div
    v-else
    role="status"
    :aria-label="$i18n.t.value.contextUsage.badgeAriaLabel(formatted)"
    class="text-muted-foreground bg-background/70 flex h-auto shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-normal"
  >
    <Gauge :size="14" />
    <span>{{ $i18n.t.value.contextUsage.label }}</span>
    <span class="font-mono">{{ formatted }}%</span>
  </div>
</template>
