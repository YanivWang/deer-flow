import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

import type { ScheduledTask } from "../../core/api/scheduled-tasks/client";
import {
  CRON_BUILDER_MODES,
  CRON_MONTH_DAYS,
  CRON_PRESETS,
  CRON_WEEKDAYS,
  FALLBACK_TIMEZONES,
  SCHEDULE_RECIPES,
  buildCronFromBuilder,
  cronBuilderFromExpression,
  detectBrowserTimezone,
  formatSchedulePreview,
  formatTimezoneAffordance,
  toLocalDatetimeInput,
  uniqueStrings,
  type CronBuilderMode,
} from "../../entities/scheduled-task/model";
import { useScheduledTasks } from "../../entities/scheduled-task/use-scheduled-tasks";
import { buildCreateScheduledTaskPayload } from "./create-scheduled-task/model";
import { canDeleteScheduledTask } from "./delete-scheduled-task/model";
import { buildEditScheduledTaskPayload } from "./edit-scheduled-task/model";

export function useScheduledTaskPage(
  threadId: MaybeRefOrGetter<string | null | undefined> = null,
) {
  const resolvedThreadId = computed(() => toValue(threadId) || null);
  const scheduled = useScheduledTasks(resolvedThreadId);
  const title = ref("");
  const prompt = ref("");
  const scheduleType = ref<"cron" | "once">("cron");
  const cron = ref("0 9 * * *");
  const cronBuilderMode = ref<CronBuilderMode>("daily");
  const cronBuilderHour = ref("09");
  const cronBuilderMinute = ref("00");
  const cronBuilderWeekday = ref("1");
  const cronBuilderMonthDay = ref("1");
  const runAtLocal = ref("");
  const timezone = ref("UTC");
  const formError = ref<string | null>(null);
  const statusFilter = ref<"all" | ScheduledTask["status"]>("all");
  const typeFilter = ref<"all" | ScheduledTask["schedule_type"]>("all");
  const isEditing = ref(false);
  const editTitle = ref("");
  const editPrompt = ref("");
  const editCron = ref("0 9 * * *");
  const editRunAtLocal = ref("");
  const editTimezone = ref("UTC");
  const editError = ref<string | null>(null);
  const timezoneOptions = computed(() =>
    uniqueStrings([detectBrowserTimezone(), ...FALLBACK_TIMEZONES]),
  );

  const filteredTasks = computed(() =>
    scheduled.tasks.value.filter((task) => {
      const statusMatches = statusFilter.value === "all" || task.status === statusFilter.value;
      const typeMatches = typeFilter.value === "all" || task.schedule_type === typeFilter.value;
      return statusMatches && typeMatches;
    }),
  );
  const visibleSelectedTask = computed(
    () => filteredTasks.value.find((task) => task.id === scheduled.selectedTaskId.value) ?? null,
  );
  const loadErrorMessage = computed(() =>
    scheduled.query.error.value instanceof Error ? scheduled.query.error.value.message : null,
  );
  const createSchedulePreview = computed(() =>
    formatSchedulePreview({
      cron: cron.value,
      runAtLocal: runAtLocal.value,
      scheduleType: scheduleType.value,
      timezone: timezone.value,
    }),
  );
  const createTimezoneAffordance = computed(() =>
    formatTimezoneAffordance({
      cron: cron.value,
      runAtLocal: runAtLocal.value,
      scheduleType: scheduleType.value,
      timezone: timezone.value,
    }),
  );
  const editSchedulePreview = computed(() => {
    const task = visibleSelectedTask.value;
    return task
      ? formatSchedulePreview({
          cron: editCron.value,
          runAtLocal: editRunAtLocal.value,
          scheduleType: task.schedule_type,
          timezone: editTimezone.value,
        })
      : "";
  });
  const editTimezoneAffordance = computed(() => {
    const task = visibleSelectedTask.value;
    return task
      ? formatTimezoneAffordance({
          cron: editCron.value,
          runAtLocal: editRunAtLocal.value,
          scheduleType: task.schedule_type,
          timezone: editTimezone.value,
        })
      : "";
  });

  watch(filteredTasks, (nextTasks) => {
    if (nextTasks.length === 0) {
      scheduled.selectedTaskId.value = null;
      return;
    }
    if (
      !scheduled.selectedTaskId.value ||
      !nextTasks.some((task) => task.id === scheduled.selectedTaskId.value)
    ) {
      scheduled.selectedTaskId.value = nextTasks[0]?.id ?? null;
    }
  }, { immediate: true });

  watch(() => visibleSelectedTask.value?.id, () => {
    seedEditForm(visibleSelectedTask.value);
  }, { immediate: true });

  async function submitTask() {
    const result = buildCreateScheduledTaskPayload({
      contextThreadId: resolvedThreadId.value,
      cron: cron.value,
      prompt: prompt.value,
      runAtLocal: runAtLocal.value,
      scheduleType: scheduleType.value,
      timezone: timezone.value,
      title: title.value,
    });
    if ("error" in result) {
      formError.value = result.error;
      return;
    }
    formError.value = null;
    await scheduled.createTask(result.payload);
    title.value = "";
    prompt.value = "";
    runAtLocal.value = "";
  }

  async function submitEditTask() {
    const task = visibleSelectedTask.value;
    if (!task) {
      return;
    }
    const result = buildEditScheduledTaskPayload({
      cron: editCron.value,
      prompt: editPrompt.value,
      runAtLocal: editRunAtLocal.value,
      task,
      timezone: editTimezone.value,
      title: editTitle.value,
    });
    if ("error" in result) {
      editError.value = result.error;
      return;
    }
    editError.value = null;
    await scheduled.updateTask({ payload: result.payload, taskId: task.id });
    isEditing.value = false;
  }

  async function refreshScheduledTasks() {
    await scheduled.query.refetch();
  }

  async function pauseSelectedTask() {
    if (visibleSelectedTask.value) {
      await scheduled.pauseTask(visibleSelectedTask.value.id);
    }
  }

  async function resumeSelectedTask() {
    if (visibleSelectedTask.value) {
      await scheduled.resumeTask(visibleSelectedTask.value.id);
    }
  }

  async function triggerSelectedTask() {
    if (visibleSelectedTask.value) {
      await scheduled.triggerTask(visibleSelectedTask.value.id);
    }
  }

  async function deleteSelectedTask() {
    if (canDeleteScheduledTask(visibleSelectedTask.value)) {
      await scheduled.deleteTask(visibleSelectedTask.value.id);
    }
  }

  function applyRecipe(recipe: (typeof SCHEDULE_RECIPES)[number]) {
    title.value = recipe.title;
    prompt.value = recipe.prompt;
    scheduleType.value = "cron";
    cron.value = recipe.cron;
    seedCronBuilder(recipe.cron);
    timezone.value = recipe.timezone || detectBrowserTimezone();
    formError.value = null;
  }

  function applyCronPreset(preset: (typeof CRON_PRESETS)[number]) {
    scheduleType.value = "cron";
    cron.value = preset.cron;
    seedCronBuilder(preset.cron);
    formError.value = null;
  }

  function applyCronBuilder() {
    const nextCron = buildCronFromBuilder({
      dayOfMonth: cronBuilderMonthDay.value,
      dayOfWeek: cronBuilderWeekday.value,
      hour: cronBuilderHour.value,
      minute: cronBuilderMinute.value,
      mode: cronBuilderMode.value,
    });
    if (!nextCron) {
      formError.value = "请选择有效的 Cron 构建器值。";
      return;
    }
    cron.value = nextCron;
    formError.value = null;
  }

  function seedCronBuilder(expression: string) {
    const seed = cronBuilderFromExpression(expression);
    if (!seed) {
      return;
    }
    cronBuilderMode.value = seed.mode;
    cronBuilderHour.value = seed.hour;
    cronBuilderMinute.value = seed.minute;
    cronBuilderWeekday.value = seed.weekday;
    cronBuilderMonthDay.value = seed.monthDay;
  }

  function seedEditForm(task: ScheduledTask | null) {
    if (!task) {
      isEditing.value = false;
      return;
    }
    isEditing.value = false;
    editError.value = null;
    editTitle.value = task.title;
    editPrompt.value = task.prompt;
    editTimezone.value = task.timezone || "UTC";
    editCron.value = typeof task.schedule_spec.cron === "string" && task.schedule_spec.cron
      ? task.schedule_spec.cron
      : "0 9 * * *";
    editRunAtLocal.value = typeof task.schedule_spec.run_at === "string"
      ? toLocalDatetimeInput(task.schedule_spec.run_at)
      : "";
  }

  return {
    ...scheduled,
    applyCronBuilder,
    applyCronPreset,
    applyRecipe,
    createSchedulePreview,
    createTimezoneAffordance,
    cron,
    cronBuilderHour,
    cronBuilderMinute,
    cronBuilderMode,
    cronBuilderMonthDay,
    cronBuilderWeekday,
    cronBuilderModes: CRON_BUILDER_MODES,
    cronMonthDays: CRON_MONTH_DAYS,
    cronPresets: CRON_PRESETS,
    cronWeekdays: CRON_WEEKDAYS,
    deleteSelectedTask,
    editCron,
    editError,
    editPrompt,
    editRunAtLocal,
    editSchedulePreview,
    editTimezone,
    editTimezoneAffordance,
    editTitle,
    filteredTasks,
    formError,
    isEditing,
    loadErrorMessage,
    pauseSelectedTask,
    prompt,
    refreshScheduledTasks,
    resolvedThreadId,
    resumeSelectedTask,
    runAtLocal,
    scheduleRecipes: SCHEDULE_RECIPES,
    scheduleType,
    statusFilter,
    submitEditTask,
    submitTask,
    timezone,
    timezoneOptions,
    title,
    triggerSelectedTask,
    typeFilter,
    visibleSelectedTask,
  };
}

export type ScheduledTaskPageController = ReturnType<typeof useScheduledTaskPage>;
