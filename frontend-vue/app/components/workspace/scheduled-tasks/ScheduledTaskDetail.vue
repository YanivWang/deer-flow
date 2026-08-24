<script setup lang="ts">
/*
  【文件职责】     Scheduled-task 详情、完整动作入口和删除二次确认。
  【架构位置】     L3 presentational component
  【主要导出】     默认 ScheduledTaskDetail
  【依赖关系】     scheduled-tasks cron/types · ScheduledTaskRunList · app i18n
  【边界与注意】   running 时禁用冲突动作；实际 mutation 与 Gateway 错误由页面/composable 持有。
*/
import { computed, ref } from "vue";

import ScheduledTaskRunList from "./ScheduledTaskRunList.vue";
import { describeSchedule, parseCron } from "@/core/scheduled-tasks/cron";
import type {
  ScheduledTask,
  ScheduledTaskRun,
} from "@/core/scheduled-tasks/types";

const props = defineProps<{
  task: ScheduledTask;
  runs: ScheduledTaskRun[];
  runsLoading: boolean;
  runsLoadingMore: boolean;
  runsHasMore: boolean;
  runsError?: string | null;
  pending: boolean;
}>();
const emit = defineEmits<{
  edit: [];
  pause: [];
  resume: [];
  trigger: [];
  delete: [];
  loadMoreRuns: [];
}>();
const { $i18n } = useNuxtApp();
const confirmingDelete = ref(false);
const locked = computed(() => props.pending || props.task.status === "running");

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat($i18n.locale.value, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

const scheduleDescription = computed(() => {
  const locale = $i18n.locale.value === "zh-CN" ? "zh" : "en";
  if (props.task.schedule_type === "once") {
    return describeSchedule(
      {
        scheduleType: "once",
        runAtLocal: formatTimestamp(
          String(props.task.schedule_spec.run_at ?? ""),
        ),
        timezone: props.task.timezone,
      },
      locale,
    );
  }
  const parsed = parseCron(String(props.task.schedule_spec.cron ?? ""));
  return describeSchedule(
    {
      scheduleType: "cron",
      preset: parsed.preset,
      parts: parsed.parts,
      timezone: props.task.timezone,
    },
    locale,
  );
});

function confirmDelete() {
  confirmingDelete.value = false;
  emit("delete");
}
</script>

<template>
  <article
    data-testid="scheduled-task-detail"
    class="border-border space-y-5 rounded-xl border p-4"
  >
    <header class="space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <h2 class="text-lg font-semibold">{{ task.title }}</h2>
        <span class="bg-muted rounded-full px-2 py-1 text-xs">{{
          $i18n.t.value.scheduledTasks.status[task.status]
        }}</span>
      </div>
      <p class="text-muted-foreground text-sm whitespace-pre-wrap">
        {{ task.prompt }}
      </p>
    </header>

    <dl class="grid gap-x-3 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      <dt class="text-muted-foreground">
        {{ $i18n.t.value.scheduledTasks.detail.schedule }}
      </dt>
      <dd>{{ scheduleDescription }}</dd>
      <dt class="text-muted-foreground">
        {{ $i18n.t.value.scheduledTasks.fields.timezone }}
      </dt>
      <dd>{{ task.timezone }}</dd>
      <dt class="text-muted-foreground">
        {{ $i18n.t.value.scheduledTasks.detail.contextMode }}
      </dt>
      <dd>
        {{
          task.context_mode === "reuse_thread"
            ? $i18n.t.value.scheduledTasks.context.reuse
            : $i18n.t.value.scheduledTasks.context.fresh
        }}
      </dd>
      <dt class="text-muted-foreground">
        {{ $i18n.t.value.scheduledTasks.detail.thread }}
      </dt>
      <dd class="break-all">{{ task.thread_id ?? "—" }}</dd>
      <dt class="text-muted-foreground">
        {{ $i18n.t.value.scheduledTasks.detail.nextRun }}
      </dt>
      <dd>{{ formatTimestamp(task.next_run_at) }}</dd>
      <dt class="text-muted-foreground">
        {{ $i18n.t.value.scheduledTasks.detail.lastRun }}
      </dt>
      <dd>{{ formatTimestamp(task.last_run_at) }}</dd>
      <dt class="text-muted-foreground">
        {{ $i18n.t.value.scheduledTasks.detail.lastRunId }}
      </dt>
      <dd class="break-all">{{ task.last_run_id ?? "—" }}</dd>
      <dt class="text-muted-foreground">
        {{ $i18n.t.value.scheduledTasks.detail.lastThread }}
      </dt>
      <dd class="break-all">{{ task.last_thread_id ?? "—" }}</dd>
      <dt class="text-muted-foreground">
        {{ $i18n.t.value.scheduledTasks.detail.runCount }}
      </dt>
      <dd>{{ task.run_count }}</dd>
      <template v-if="task.last_error">
        <dt class="text-muted-foreground">
          {{ $i18n.t.value.scheduledTasks.detail.lastError }}
        </dt>
        <dd class="break-words text-red-700">{{ task.last_error }}</dd>
      </template>
    </dl>

    <p
      v-if="task.status === 'running'"
      class="rounded-md bg-amber-50 p-2 text-xs text-amber-800"
    >
      {{ $i18n.t.value.scheduledTasks.detail.runningLocked }}
    </p>
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-md border px-3 py-2 text-sm"
        :disabled="locked"
        @click="emit('edit')"
      >
        {{ $i18n.t.value.scheduledTasks.actions.edit }}
      </button>
      <button
        v-if="task.status === 'paused'"
        type="button"
        class="rounded-md border px-3 py-2 text-sm"
        :disabled="locked"
        @click="emit('resume')"
      >
        {{ $i18n.t.value.scheduledTasks.actions.resume }}
      </button>
      <button
        v-else
        type="button"
        class="rounded-md border px-3 py-2 text-sm"
        :disabled="locked"
        @click="emit('pause')"
      >
        {{ $i18n.t.value.scheduledTasks.actions.pause }}
      </button>
      <button
        type="button"
        data-testid="scheduled-task-trigger"
        class="rounded-md border px-3 py-2 text-sm"
        :disabled="locked"
        @click="emit('trigger')"
      >
        {{ $i18n.t.value.scheduledTasks.actions.trigger }}
      </button>
      <button
        type="button"
        data-testid="scheduled-task-delete"
        class="text-destructive rounded-md border px-3 py-2 text-sm"
        :disabled="locked"
        @click="confirmingDelete = true"
      >
        {{ $i18n.t.value.scheduledTasks.actions.delete }}
      </button>
    </div>

    <ScheduledTaskRunList
      :runs="runs"
      :loading="runsLoading"
      :loading-more="runsLoadingMore"
      :has-more="runsHasMore"
      :error="runsError"
      @load-more="emit('loadMoreRuns')"
    />
  </article>

  <Teleport to="body">
    <div
      v-if="confirmingDelete"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-black/45"
      @click.self="confirmingDelete = false"
    >
      <section
        role="dialog"
        aria-modal="true"
        data-testid="scheduled-task-delete-dialog"
        class="bg-background w-[min(92vw,28rem)] rounded-xl border p-5 shadow-2xl"
      >
        <h2 class="font-semibold">
          {{ $i18n.t.value.scheduledTasks.actions.delete }}
        </h2>
        <p class="text-muted-foreground mt-2 text-sm">
          {{ $i18n.t.value.scheduledTasks.deleteConfirm }}
        </p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border px-3 py-2 text-sm"
            @click="confirmingDelete = false"
          >
            {{ $i18n.t.value.common.cancel }}
          </button>
          <button
            type="button"
            data-testid="scheduled-task-delete-confirm"
            class="bg-destructive text-destructive-foreground rounded-md px-3 py-2 text-sm"
            @click="confirmDelete"
          >
            {{ $i18n.t.value.scheduledTasks.actions.delete }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
