<script setup lang="ts">
/*
  【文件职责】     在 run 尚无终态 assistant 气泡时显示实时工作状态与墙钟时长。
  【架构位置】     L3 chat UI adapter
  【主要导出】     默认 RunActivity 组件
  【依赖关系】     core/messages/run-duration
  【边界与注意】   后端没有 live start timestamp；中途挂载从当前前端观察时刻计时。
*/
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Clock3 } from "lucide-vue-next";

import { formatRunDuration } from "@/core/messages/run-duration";

const props = defineProps<{ startTime: number | null }>();
const { $i18n } = useNuxtApp();
const elapsed = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

function updateElapsed() {
  elapsed.value = props.startTime
    ? Math.max(0, Math.floor((Date.now() - props.startTime) / 1_000))
    : 0;
}
function restartTimer() {
  if (timer) clearInterval(timer);
  timer = undefined;
  updateElapsed();
  if (props.startTime !== null) timer = setInterval(updateElapsed, 1_000);
}
const formatted = computed(() =>
  formatRunDuration(elapsed.value, {
    lessThanSecond: $i18n.t.value.runDuration.lessThanSecond,
    hours: $i18n.t.value.runDuration.hours,
    minutes: $i18n.t.value.runDuration.minutes,
    seconds: $i18n.t.value.runDuration.seconds,
    separator: $i18n.t.value.runDuration.separator,
  }),
);

watch(() => props.startTime, restartTimer);
onMounted(restartTimer);
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div
    data-testid="run-activity"
    class="text-muted-foreground flex items-center gap-2 text-sm"
  >
    <Clock3 :size="16" />
    <span class="animate-pulse">{{ $i18n.t.value.runDuration.working }}</span>
    <span v-if="formatted" aria-hidden="true">({{ formatted }})</span>
  </div>
</template>
