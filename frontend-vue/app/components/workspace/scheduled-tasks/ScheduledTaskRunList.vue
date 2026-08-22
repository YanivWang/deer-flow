<script setup lang="ts">
/*
  【文件职责】     Scheduled-task run 全字段列表与 limit/offset 继续加载控件。
  【对应 frontend/】 app/workspace/scheduled-tasks/page.tsx run history
  【架构位置】     L3 presentational component
  【主要导出】     默认 ScheduledTaskRunList
  【依赖关系】     scheduled-tasks/types · app i18n
  【边界与注意】   只显示 composable 已分页加载的数据；不把首 50 条伪装成完整历史。
*/
import type { ScheduledTaskRun } from "@/core/scheduled-tasks/types";

defineProps<{
  runs: ScheduledTaskRun[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error?: string | null;
}>();
const emit = defineEmits<{ loadMore: [] }>();
const { $i18n } = useNuxtApp();

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat($i18n.locale.value, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}
</script>

<template>
  <section data-testid="scheduled-task-runs" class="space-y-3">
    <h3 class="font-medium">
      {{
        runs.length === 1
          ? $i18n.t.value.scheduledTasks.detail.runsCountOne.replace(
              "{count}",
              String(runs.length),
            )
          : $i18n.t.value.scheduledTasks.detail.runsCount.replace(
              "{count}",
              String(runs.length),
            )
      }}
    </h3>
    <p v-if="error" role="alert" class="text-sm text-red-700">{{ error }}</p>
    <p v-if="loading" role="status" class="text-muted-foreground text-sm">
      {{ $i18n.t.value.scheduledTasks.detail.loadingRuns }}
    </p>
    <p v-else-if="runs.length === 0" class="text-muted-foreground text-sm">
      {{ $i18n.t.value.scheduledTasks.detail.noRuns }}
    </p>
    <div data-testid="scheduled-task-run-list" class="space-y-2">
      <article
        v-for="run in runs"
        :key="run.id"
        :data-testid="`scheduled-task-run-${run.id}`"
        class="bg-muted/60 rounded-lg p-3 text-sm"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <strong>{{
            $i18n.t.value.scheduledTasks.runTrigger[run.trigger]
          }}</strong>
          <span>{{ $i18n.t.value.scheduledTasks.runStatus[run.status] }}</span>
        </div>
        <dl
          class="text-muted-foreground mt-2 grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[auto_1fr]"
        >
          <dt>{{ $i18n.t.value.scheduledTasks.runFields.scheduledFor }}</dt>
          <dd>{{ formatTimestamp(run.scheduled_for) }}</dd>
          <dt>{{ $i18n.t.value.scheduledTasks.runFields.startedAt }}</dt>
          <dd>{{ formatTimestamp(run.started_at) }}</dd>
          <dt>{{ $i18n.t.value.scheduledTasks.runFields.finishedAt }}</dt>
          <dd>{{ formatTimestamp(run.finished_at) }}</dd>
          <dt>{{ $i18n.t.value.scheduledTasks.runFields.threadId }}</dt>
          <dd class="break-all">{{ run.thread_id }}</dd>
          <dt>{{ $i18n.t.value.scheduledTasks.runFields.runId }}</dt>
          <dd class="break-all">{{ run.run_id ?? "—" }}</dd>
          <template v-if="run.error">
            <dt>{{ $i18n.t.value.scheduledTasks.runFields.error }}</dt>
            <dd class="break-words text-red-700">{{ run.error }}</dd>
          </template>
        </dl>
      </article>
    </div>
    <button
      v-if="hasMore"
      type="button"
      data-testid="scheduled-task-load-more-runs"
      class="w-full rounded-md border px-3 py-2 text-sm"
      :disabled="loadingMore"
      @click="emit('loadMore')"
    >
      {{
        loadingMore
          ? $i18n.t.value.scheduledTasks.detail.loadingMore
          : $i18n.t.value.scheduledTasks.detail.loadMore
      }}
    </button>
  </section>
</template>
