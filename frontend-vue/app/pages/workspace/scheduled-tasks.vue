<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import {
  createScheduledTask,
  fetchScheduledTaskRuns,
  fetchScheduledTasks,
  fetchThreadScheduledTasks,
  pauseScheduledTask,
  resumeScheduledTask,
  triggerScheduledTask,
} from "@/core/scheduled-tasks/api";
import { zonedLocalToUtcIso } from "@/core/scheduled-tasks/cron";
import type {
  ScheduledTask,
  ScheduledTaskRun,
} from "@/core/scheduled-tasks/types";

definePageMeta({ layout: "workspace" });
const route = useRoute();
const threadId = computed(() => {
  const value = route.query.thread_id;
  return (Array.isArray(value) ? value[0] : value) ?? null;
});
const tasks = ref<ScheduledTask[]>([]);
const selectedId = ref<string | null>(null);
const runs = ref<ScheduledTaskRun[]>([]);
const statusFilter = ref<"all" | "enabled" | "paused">("all");
const scheduleType = ref<"cron" | "once">("cron");
const runAt = ref("");
const title = ref("");
const prompt = ref("");
const error = ref<string | null>(null);

const filteredTasks = computed(() =>
  statusFilter.value === "all"
    ? tasks.value
    : tasks.value.filter((task) => task.status === statusFilter.value),
);
const selectedTask = computed(
  () =>
    filteredTasks.value.find((task) => task.id === selectedId.value) ??
    filteredTasks.value[0] ??
    null,
);

async function loadTasks() {
  try {
    tasks.value = threadId.value
      ? await fetchThreadScheduledTasks(threadId.value)
      : await fetchScheduledTasks();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Failed to load scheduled tasks";
  }
}

async function loadRuns() {
  runs.value = selectedTask.value
    ? await fetchScheduledTaskRuns(selectedTask.value.id)
    : [];
}

watch(
  () => selectedTask.value?.id,
  () => void loadRuns(),
);

async function createTask() {
  error.value = null;
  try {
    const created = await createScheduledTask({
      context_mode: threadId.value ? "reuse_thread" : "fresh_thread_per_run",
      thread_id: threadId.value,
      title: title.value,
      prompt: prompt.value,
      schedule_type: scheduleType.value,
      schedule_spec:
        scheduleType.value === "once"
          ? { run_at: zonedLocalToUtcIso(runAt.value, "UTC") }
          : { cron: "0 9 * * *" },
      timezone: "UTC",
    });
    tasks.value.unshift(created);
    selectedId.value = created.id;
    title.value = "";
    prompt.value = "";
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "Failed to create scheduled task";
  }
}

async function togglePaused() {
  const task = selectedTask.value;
  if (!task) return;
  const next =
    task.status === "paused"
      ? await resumeScheduledTask(task.id)
      : await pauseScheduledTask(task.id);
  tasks.value = tasks.value.map((item) => (item.id === next.id ? next : item));
}

async function trigger() {
  const task = selectedTask.value;
  if (!task) return;
  await triggerScheduledTask(task.id);
  await loadRuns();
}

onMounted(() => void loadTasks());
</script>

<template>
  <section class="h-full overflow-y-auto p-4 sm:p-6">
    <div class="mx-auto max-w-6xl space-y-4">
      <header class="flex items-center gap-3">
        <h1 class="text-2xl font-semibold">Scheduled tasks</h1>
        <span v-if="threadId" class="text-muted-foreground text-sm"
          >Filtered by thread {{ threadId }}</span
        >
      </header>
      <p
        v-if="error"
        role="alert"
        class="rounded-md bg-red-50 p-3 text-red-700"
      >
        {{ error }}
      </p>
      <form
        data-testid="scheduled-task-create-form"
        class="border-border grid gap-3 rounded-xl border p-4"
        @submit.prevent="createTask"
      >
        <h2 class="font-medium">Create scheduled task</h2>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-md border px-3 py-1.5"
            :class="scheduleType === 'cron' ? 'bg-accent' : ''"
            @click="scheduleType = 'cron'"
          >
            Recurring</button
          ><button
            type="button"
            class="rounded-md border px-3 py-1.5"
            :class="scheduleType === 'once' ? 'bg-accent' : ''"
            @click="scheduleType = 'once'"
          >
            One-time
          </button>
        </div>
        <label v-if="scheduleType === 'once'" class="text-sm"
          >Run at<input
            v-model="runAt"
            aria-label="Run at"
            type="datetime-local"
            required
            class="border-input mt-1 block rounded-md border px-3 py-2"
        /></label>
        <input
          v-model="title"
          placeholder="Task title"
          required
          class="border-input rounded-md border px-3 py-2"
        />
        <textarea
          v-model="prompt"
          placeholder="Prompt"
          required
          rows="3"
          class="border-input rounded-md border px-3 py-2"
        />
        <button
          type="submit"
          class="bg-primary text-primary-foreground w-fit rounded-md px-4 py-2"
        >
          Create
        </button>
      </form>

      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-md border px-3 py-1.5"
          @click="statusFilter = 'all'"
        >
          All</button
        ><button
          type="button"
          class="rounded-md border px-3 py-1.5"
          @click="statusFilter = 'enabled'"
        >
          Enabled</button
        ><button
          type="button"
          class="rounded-md border px-3 py-1.5"
          @click="statusFilter = 'paused'"
        >
          Paused
        </button>
      </div>
      <div
        class="grid min-h-80 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
      >
        <div class="space-y-2">
          <button
            v-for="task in filteredTasks"
            :key="task.id"
            type="button"
            :data-testid="`scheduled-task-item-${task.id}`"
            class="border-border hover:bg-accent flex w-full items-center justify-between rounded-lg border p-3 text-left"
            @click="selectedId = task.id"
          >
            <span>{{ task.title }}</span
            ><span class="text-muted-foreground text-xs capitalize">{{
              task.status
            }}</span>
          </button>
        </div>
        <article
          v-if="selectedTask"
          data-testid="scheduled-task-detail"
          class="border-border space-y-4 rounded-xl border p-4"
        >
          <div>
            <h2 class="text-lg font-semibold">{{ selectedTask.title }}</h2>
            <p class="text-muted-foreground mt-2 whitespace-pre-wrap">
              {{ selectedTask.prompt }}
            </p>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-md border px-3 py-2"
              @click="togglePaused"
            >
              {{
                selectedTask.status === "paused" ? "Resume" : "Pause"
              }}</button
            ><button
              type="button"
              class="rounded-md border px-3 py-2"
              @click="trigger"
            >
              Trigger now
            </button>
          </div>
          <section data-testid="scheduled-task-runs" class="space-y-2">
            <h3 class="font-medium">
              {{ runs.length }} {{ runs.length === 1 ? "run" : "runs" }}
            </h3>
            <div data-testid="scheduled-task-run-list" class="space-y-1">
              <div
                v-for="run in runs"
                :key="run.id"
                class="bg-muted rounded-md p-2 text-sm"
              >
                {{ run.trigger === "manual" ? "Manual" : "Scheduled" }} ·
                {{ run.status === "success" ? "Success" : run.status }}
              </div>
            </div>
          </section>
        </article>
      </div>
    </div>
  </section>
</template>
