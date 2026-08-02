<script setup lang="ts">
import { scheduleSummary } from "../../composables/use-scheduled-tasks";
import type {
  ScheduledTask,
  ScheduledTaskPayload,
  ScheduledTaskRun,
  ScheduledTaskUpdatePayload,
} from "../../core/api/scheduled-tasks/client";

type ScheduleRecipe = {
  id: string;
  title: string;
  prompt: string;
  cron: string;
  timezone?: string;
};

type CronPreset = {
  id: string;
  label: string;
  cron: string;
};

type CronBuilderMode = "hourly" | "daily" | "weekdays" | "weekly" | "monthly";

type CronBuilderModeOption = {
  label: string;
  value: CronBuilderMode;
};

const SCHEDULE_RECIPES: ScheduleRecipe[] = [
  {
    cron: "0 9 * * *",
    id: "daily-report",
    prompt: "总结最新项目进展和阻塞项。",
    title: "每日报告",
  },
  {
    cron: "0 9 * * 1",
    id: "weekly-planning",
    prompt: "准备一份包含优先级和未决风险的周计划简报。",
    title: "周计划",
  },
  {
    cron: "0 17 * * 5",
    id: "friday-review",
    prompt: "复盘本周进展并列出后续行动。",
    title: "周五复盘",
  },
];
const CRON_PRESETS: CronPreset[] = [
  { cron: "0 9 * * *", id: "daily-9", label: "每天 09:00" },
  { cron: "0 9 * * 1-5", id: "weekdays-9", label: "工作日 09:00" },
  { cron: "0 9 * * 1", id: "weekly-monday-9", label: "周一 09:00" },
  { cron: "0 * * * *", id: "hourly", label: "每小时" },
];
const CRON_BUILDER_MODES: CronBuilderModeOption[] = [
  { label: "每小时", value: "hourly" },
  { label: "每天", value: "daily" },
  { label: "工作日", value: "weekdays" },
  { label: "每周", value: "weekly" },
  { label: "每月", value: "monthly" },
];
const CRON_WEEKDAYS = [
  { label: "周日", value: "0" },
  { label: "周一", value: "1" },
  { label: "周二", value: "2" },
  { label: "周三", value: "3" },
  { label: "周四", value: "4" },
  { label: "周五", value: "5" },
  { label: "周六", value: "6" },
];
const CRON_MONTH_DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1));
const FALLBACK_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const route = useRoute();
const { t } = useAppI18n();
const threadId = computed(() => route.query.thread_id?.toString() || null);
const {
  actionErrorMessage,
  createTask,
  deleteTask,
  isActionPending,
  pauseTask,
  query,
  resumeTask,
  runs,
  runsQuery,
  selectedTaskId,
  tasks,
  triggerTask,
  updateTask,
} = useScheduledTasks(threadId);
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
const formErrorId = "vue-scheduled-form-error-message";
const editErrorId = "vue-scheduled-edit-error-message";
const loadErrorMessage = computed(() =>
  query.error.value instanceof Error ? query.error.value.message : null,
);
const timezoneOptions = computed(() => uniqueStrings([detectBrowserTimezone(), ...FALLBACK_TIMEZONES]));
const createSchedulePreview = computed(() =>
  formatCreateSchedulePreview({
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
const filteredTasks = computed(() =>
  tasks.value.filter((task) => {
    const statusMatches = statusFilter.value === "all" || task.status === statusFilter.value;
    const typeMatches = typeFilter.value === "all" || task.schedule_type === typeFilter.value;
    return statusMatches && typeMatches;
  }),
);
const visibleSelectedTask = computed(
  () => filteredTasks.value.find((task) => task.id === selectedTaskId.value) ?? null,
);
const editSchedulePreview = computed(() => {
  const task = visibleSelectedTask.value;
  if (!task) {
    return "";
  }
  return formatCreateSchedulePreview({
    cron: editCron.value,
    runAtLocal: editRunAtLocal.value,
    scheduleType: task.schedule_type,
    timezone: editTimezone.value,
  });
});
const editTimezoneAffordance = computed(() => {
  const task = visibleSelectedTask.value;
  if (!task) {
    return "";
  }
  return formatTimezoneAffordance({
    cron: editCron.value,
    runAtLocal: editRunAtLocal.value,
    scheduleType: task.schedule_type,
    timezone: editTimezone.value,
  });
});

watch(filteredTasks, (nextTasks) => {
  if (nextTasks.length === 0) {
    selectedTaskId.value = null;
    return;
  }
  if (!selectedTaskId.value || !nextTasks.some((task) => task.id === selectedTaskId.value)) {
    selectedTaskId.value = nextTasks[0]?.id ?? null;
  }
}, { immediate: true });

watch(() => visibleSelectedTask.value?.id, () => {
  seedEditForm(visibleSelectedTask.value);
}, { immediate: true });

async function submitTask() {
  const payload = buildPayload();
  if (!payload) {
    return;
  }
  await createTask(payload);
  title.value = "";
  prompt.value = "";
  runAtLocal.value = "";
}

function applyRecipe(recipe: ScheduleRecipe) {
  title.value = recipe.title;
  prompt.value = recipe.prompt;
  scheduleType.value = "cron";
  cron.value = recipe.cron;
  seedCronBuilderFromExpression(recipe.cron);
  timezone.value = recipe.timezone || detectBrowserTimezone();
  formError.value = null;
}

function applyCronPreset(preset: CronPreset) {
  scheduleType.value = "cron";
  cron.value = preset.cron;
  seedCronBuilderFromExpression(preset.cron);
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

async function refreshScheduledTasks() {
  await query.refetch();
}

async function pauseSelectedTask() {
  if (visibleSelectedTask.value) {
    await pauseTask(visibleSelectedTask.value.id);
  }
}

async function resumeSelectedTask() {
  if (visibleSelectedTask.value) {
    await resumeTask(visibleSelectedTask.value.id);
  }
}

async function triggerSelectedTask() {
  if (visibleSelectedTask.value) {
    await triggerTask(visibleSelectedTask.value.id);
  }
}

async function deleteSelectedTask() {
  if (visibleSelectedTask.value) {
    await deleteTask(visibleSelectedTask.value.id);
  }
}

async function submitEditTask() {
  if (!visibleSelectedTask.value) {
    return;
  }
  const payload = buildEditPayload(visibleSelectedTask.value);
  if (!payload) {
    return;
  }
  await updateTask({ payload, taskId: visibleSelectedTask.value.id });
  isEditing.value = false;
}

function buildPayload(): ScheduledTaskPayload | null {
  const nextTitle = title.value.trim();
  const nextPrompt = prompt.value.trim();
  const nextCron = cron.value.trim();
  const nextRunAtLocal = runAtLocal.value.trim();
  const nextTimezone = timezone.value.trim() || "UTC";
  if (!nextTitle || !nextPrompt) {
    formError.value = "标题和提示词为必填项。";
    return null;
  }
  if (scheduleType.value === "cron" && !nextCron) {
    formError.value = "Cron 计划为必填项。";
    return null;
  }
  if (scheduleType.value === "once" && !nextRunAtLocal) {
    formError.value = "运行日期和时间为必填项。";
    return null;
  }
  const scheduleSpec = buildScheduleSpec(nextCron, nextRunAtLocal);
  if (!scheduleSpec) {
    formError.value = "运行日期和时间无效。";
    return null;
  }
  formError.value = null;
  return {
    context_mode: threadId.value ? "reuse_thread" : "fresh_thread_per_run",
    ...(threadId.value ? { thread_id: threadId.value } : {}),
    prompt: nextPrompt,
    schedule_spec: scheduleSpec,
    schedule_type: scheduleType.value,
    timezone: nextTimezone,
    title: nextTitle,
  };
}

function buildScheduleSpec(
  nextCron: string,
  nextRunAtLocal: string,
): ScheduledTaskPayload["schedule_spec"] | null {
  if (scheduleType.value === "cron") {
    return { cron: nextCron };
  }
  const runAt = normalizeDatetimeLocalForSchedule(nextRunAtLocal);
  if (!runAt) {
    return null;
  }
  return { run_at: runAt };
}

function buildEditPayload(task: ScheduledTask): ScheduledTaskUpdatePayload | null {
  const nextTitle = editTitle.value.trim();
  const nextPrompt = editPrompt.value.trim();
  const nextTimezone = editTimezone.value.trim() || "UTC";
  if (!nextTitle || !nextPrompt) {
    editError.value = "标题和提示词为必填项。";
    return null;
  }
  const scheduleSpec =
    task.schedule_type === "cron"
      ? buildCronEditSpec()
      : buildOnceEditSpec();
  if (!scheduleSpec) {
    editError.value =
      task.schedule_type === "cron" ? "Cron 计划为必填项。" : "运行日期和时间无效。";
    return null;
  }
  editError.value = null;
  return {
    prompt: nextPrompt,
    schedule_spec: scheduleSpec,
    timezone: nextTimezone,
    title: nextTitle,
  };
}

function buildCronEditSpec(): ScheduledTaskPayload["schedule_spec"] | null {
  const nextCron = editCron.value.trim();
  return nextCron ? { cron: nextCron } : null;
}

function buildOnceEditSpec(): ScheduledTaskPayload["schedule_spec"] | null {
  const nextRunAtLocal = editRunAtLocal.value.trim();
  if (!nextRunAtLocal) {
    return null;
  }
  const runAt = normalizeDatetimeLocalForSchedule(nextRunAtLocal);
  if (!runAt) {
    return null;
  }
  return { run_at: runAt };
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
  const cronValue = task.schedule_spec.cron;
  editCron.value = typeof cronValue === "string" && cronValue ? cronValue : "0 9 * * *";
  const runAtValue = task.schedule_spec.run_at;
  editRunAtLocal.value = typeof runAtValue === "string" ? toLocalDatetimeInput(runAtValue) : "";
}

function toLocalDatetimeInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatCreateSchedulePreview(input: {
  cron: string;
  runAtLocal: string;
  scheduleType: "cron" | "once";
  timezone: string;
}): string {
  const nextTimezone = input.timezone.trim() || "UTC";
  if (input.scheduleType === "cron") {
    const nextCron = input.cron.trim();
    return `cron · ${formatCronPreview(nextCron)} · ${nextTimezone}`;
  }
  const runAt = normalizeDatetimeLocalForSchedule(input.runAtLocal.trim());
  if (!runAt) {
    return `单次 · 尚无有效运行时间 · ${nextTimezone}`;
  }
  return `单次 · ${formatWallClockPreview(runAt)} · ${nextTimezone}`;
}

function formatTimezoneAffordance(input: {
  cron: string;
  runAtLocal: string;
  scheduleType: "cron" | "once";
  timezone: string;
}): string {
  const nextTimezone = input.timezone.trim() || "UTC";
  if (input.scheduleType === "cron") {
    return `Gateway 会按 ${nextTimezone} 评估这个 5 字段 Cron；存储的 next_run_at 会规范化为 UTC。`;
  }
  const runAt = normalizeDatetimeLocalForSchedule(input.runAtLocal.trim());
  if (!runAt) {
    return `请选择日历时间；Gateway 会按 ${nextTimezone} 的墙钟时间处理。`;
  }
  return `Gateway 会收到不带偏移量的 ${runAt}，并将其解释为 ${formatWallClockSentence(runAt, nextTimezone)}。`;
}

function formatWallClockSentence(value: string, timezoneName: string): string {
  const datePart = value.slice(0, 10);
  const timePart = value.slice(11, 16);
  return `${timezoneName} 的 ${formatWeekdayFromDatePart(datePart)} ${datePart} ${timePart}`;
}

function formatWeekdayFromDatePart(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return "所选日期";
  }
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(new Date(timestamp));
}

function formatCronPreview(cronExpression: string): string {
  if (!cronExpression) {
    return "空表达式";
  }
  const parts = cronExpression.split(/\s+/).filter(Boolean);
  if (parts.length !== 5) {
    return `${cronExpression}（应为 5 个字段）`;
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  const recognized = describeRecognizedCron(minute, hour, dayOfMonth, month, dayOfWeek);
  if (recognized) {
    return `${recognized} (${cronExpression})`;
  }
  return `分钟 ${minute}，小时 ${hour}，日期 ${dayOfMonth}，月份 ${month}，星期 ${dayOfWeek}`;
}

function describeRecognizedCron(
  minute: string,
  hour: string,
  dayOfMonth: string,
  month: string,
  dayOfWeek: string,
): string | null {
  if (hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return /^\d{1,2}$/.test(minute) && Number(minute) <= 59
      ? `每小时第 ${String(Number(minute)).padStart(2, "0")} 分钟`
      : null;
  }
  const time = formatCronTime(hour, minute);
  if (!time || dayOfMonth !== "*" || month !== "*") {
    return null;
  }
  if (dayOfWeek === "*") {
    return `每天 ${time}`;
  }
  if (dayOfWeek === "1-5") {
    return `工作日 ${time}`;
  }
  const weekday = cronWeekdayName(dayOfWeek);
  return weekday ? `${weekday} ${time}` : null;
}

function buildCronFromBuilder(input: {
  dayOfMonth: string;
  dayOfWeek: string;
  hour: string;
  minute: string;
  mode: CronBuilderMode;
}): string | null {
  const minute = normalizeCronNumber(input.minute, 0, 59);
  if (!minute) {
    return null;
  }
  if (input.mode === "hourly") {
    return `${minute} * * * *`;
  }

  const hour = normalizeCronNumber(input.hour, 0, 23);
  if (!hour) {
    return null;
  }
  if (input.mode === "daily") {
    return `${minute} ${hour} * * *`;
  }
  if (input.mode === "weekdays") {
    return `${minute} ${hour} * * 1-5`;
  }
  if (input.mode === "weekly") {
    const dayOfWeek = normalizeCronNumber(input.dayOfWeek, 0, 6);
    return dayOfWeek ? `${minute} ${hour} * * ${dayOfWeek}` : null;
  }

  const dayOfMonth = normalizeCronNumber(input.dayOfMonth, 1, 31);
  return dayOfMonth ? `${minute} ${hour} ${dayOfMonth} * *` : null;
}

function normalizeCronNumber(value: string, min: number, max: number): string | null {
  if (!/^\d{1,2}$/.test(value)) {
    return null;
  }
  const numeric = Number(value);
  if (numeric < min || numeric > max) {
    return null;
  }
  return String(numeric);
}

function seedCronBuilderFromExpression(expression: string) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return;
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  if (month !== "*") {
    return;
  }
  cronBuilderMinute.value = normalizeCronNumber(minute, 0, 59) ?? cronBuilderMinute.value;
  if (hour === "*" && dayOfMonth === "*" && dayOfWeek === "*") {
    cronBuilderMode.value = "hourly";
    return;
  }
  cronBuilderHour.value = normalizeCronNumber(hour, 0, 23)?.padStart(2, "0") ?? cronBuilderHour.value;
  if (dayOfMonth === "*" && dayOfWeek === "*") {
    cronBuilderMode.value = "daily";
    return;
  }
  if (dayOfMonth === "*" && dayOfWeek === "1-5") {
    cronBuilderMode.value = "weekdays";
    return;
  }
  if (dayOfMonth === "*") {
    const normalizedWeekday = normalizeCronNumber(dayOfWeek, 0, 6);
    if (normalizedWeekday) {
      cronBuilderMode.value = "weekly";
      cronBuilderWeekday.value = normalizedWeekday;
    }
    return;
  }
  const normalizedMonthDay = normalizeCronNumber(dayOfMonth, 1, 31);
  if (dayOfWeek === "*" && normalizedMonthDay) {
    cronBuilderMode.value = "monthly";
    cronBuilderMonthDay.value = normalizedMonthDay;
  }
}

function formatCronTime(hour: string, minute: string): string | null {
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) {
    return null;
  }
  const numericHour = Number(hour);
  const numericMinute = Number(minute);
  if (numericHour > 23 || numericMinute > 59) {
    return null;
  }
  return `${String(numericHour).padStart(2, "0")}:${String(numericMinute).padStart(2, "0")}`;
}

function cronWeekdayName(value: string): string | null {
  const names: Record<string, string> = {
    "0": "周日",
    "1": "周一",
    "2": "周二",
    "3": "周三",
    "4": "周四",
    "5": "周五",
    "6": "周六",
    "7": "周日",
  };
  return names[value] ?? null;
}

function normalizeDatetimeLocalForSchedule(value: string): string | null {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const parsed = new Date(year, month - 1, day, hour, minute);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }
  return `${trimmed}:00`;
}

function formatWallClockPreview(value: string): string {
  return value.replace("T", " ").replace(/:00$/, "");
}

function formatTaskTimestamp(value: string | null, timezoneName: string): string {
  if (!value) {
    return "无";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezoneName || "UTC",
  }).format(date);
}

function formatTaskStatusLabel(status: ScheduledTask["status"]): string {
  const labels: Record<ScheduledTask["status"], string> = {
    cancelled: "已取消",
    completed: "已完成",
    enabled: "已启用",
    failed: "失败",
    paused: "已暂停",
    running: "运行中",
  };
  return labels[status];
}

function formatRunStatusLabel(status: ScheduledTaskRun["status"]): string {
  const labels: Record<ScheduledTaskRun["status"], string> = {
    failed: "失败",
    interrupted: "已中断",
    queued: "排队中",
    running: "运行中",
    skipped: "已跳过",
    success: "成功",
  };
  return labels[status];
}

function formatRunTriggerLabel(trigger: ScheduledTaskRun["trigger"]): string {
  return trigger === "manual" ? "手动触发" : "计划触发";
}

function detectBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}
</script>

<template>
  <WorkspaceNavShell>
  <section class="scheduled-page">
    <header class="scheduled-page__header">
      <div>
        <p class="workspace-chat__eyebrow">工作区</p>
        <h1>计划任务</h1>
      </div>
      <a-button
        :loading="query.isFetching.value"
        data-testid="vue-scheduled-refresh"
        @click="refreshScheduledTasks"
      >
        刷新
      </a-button>
    </header>

    <a-alert
      v-if="loadErrorMessage"
      data-testid="vue-scheduled-load-error"
      role="alert"
      type="error"
      show-icon
      :message="loadErrorMessage"
    />
    <a-alert
      v-if="actionErrorMessage"
      data-testid="vue-scheduled-action-error"
      role="alert"
      type="error"
      show-icon
      :message="actionErrorMessage"
    />

    <div data-testid="scheduled-task-create-form">
    <form
      class="scheduled-create"
      data-testid="vue-scheduled-create-form"
      @submit.prevent="submitTask"
    >
      <h2>创建计划任务</h2>
      <section class="scheduled-create__recipes" data-testid="vue-scheduled-recipes">
        <h3>模板</h3>
        <button
          v-for="recipe in SCHEDULE_RECIPES"
          :key="recipe.id"
          type="button"
          class="scheduled-create__type-button"
          :data-testid="`vue-scheduled-recipe-${recipe.id}`"
          @click="applyRecipe(recipe)"
        >
          {{ recipe.title }}
        </button>
      </section>
      <label>
        <span>{{ t("scheduledTasks.create.taskTitle") }}</span>
        <input
          v-model="title"
          :placeholder="t('scheduledTasks.create.taskTitle')"
          data-testid="vue-scheduled-title"
        >
      </label>
      <label>
        <span>{{ t("scheduledTasks.create.prompt") }}</span>
        <textarea
          v-model="prompt"
          :placeholder="t('scheduledTasks.create.prompt')"
          data-testid="vue-scheduled-prompt"
        />
      </label>
      <div class="scheduled-create__type" data-testid="vue-scheduled-type" role="group">
        <button
          type="button"
          :class="{ 'scheduled-create__type-button--active': scheduleType === 'cron' }"
          data-testid="vue-scheduled-type-cron"
          @click="scheduleType = 'cron'"
        >
          Cron
        </button>
        <button
          type="button"
          :class="{ 'scheduled-create__type-button--active': scheduleType === 'once' }"
          data-testid="vue-scheduled-type-once"
          @click="scheduleType = 'once'"
        >
          {{ t("scheduledTasks.scheduleType.once") }}
        </button>
      </div>
      <label v-if="scheduleType === 'cron'">
        <span>Cron</span>
        <input
          v-model="cron"
          data-testid="vue-scheduled-cron"
          @input="formError = null"
        >
      </label>
      <section
        v-if="scheduleType === 'cron'"
        class="scheduled-create__builder"
        data-testid="vue-scheduled-cron-builder"
      >
        <h3>结构化 Cron 构建器</h3>
        <label>
          <span>重复</span>
          <select
            v-model="cronBuilderMode"
            data-testid="vue-scheduled-cron-builder-mode"
            @change="applyCronBuilder"
          >
            <option
              v-for="mode in CRON_BUILDER_MODES"
              :key="mode.value"
              :value="mode.value"
            >
              {{ mode.label }}
            </option>
          </select>
        </label>
        <label>
          <span>小时</span>
          <input
            v-model="cronBuilderHour"
            data-testid="vue-scheduled-cron-builder-hour"
            inputmode="numeric"
            maxlength="2"
            @input="applyCronBuilder"
          >
        </label>
        <label>
          <span>分钟</span>
          <input
            v-model="cronBuilderMinute"
            data-testid="vue-scheduled-cron-builder-minute"
            inputmode="numeric"
            maxlength="2"
            @input="applyCronBuilder"
          >
        </label>
        <label v-if="cronBuilderMode === 'weekly'">
          <span>星期</span>
          <select
            v-model="cronBuilderWeekday"
            data-testid="vue-scheduled-cron-builder-weekday"
            @change="applyCronBuilder"
          >
            <option
              v-for="weekday in CRON_WEEKDAYS"
              :key="weekday.value"
              :value="weekday.value"
            >
              {{ weekday.label }}
            </option>
          </select>
        </label>
        <label v-if="cronBuilderMode === 'monthly'">
          <span>每月日期</span>
          <select
            v-model="cronBuilderMonthDay"
            data-testid="vue-scheduled-cron-builder-month-day"
            @change="applyCronBuilder"
          >
            <option v-for="day in CRON_MONTH_DAYS" :key="day" :value="day">
              {{ day }}
            </option>
          </select>
        </label>
      </section>
      <section v-if="scheduleType === 'cron'" class="scheduled-create__presets" data-testid="vue-scheduled-cron-presets">
        <h3>Cron 预设</h3>
        <button
          v-for="preset in CRON_PRESETS"
          :key="preset.id"
          type="button"
          class="scheduled-create__type-button"
          :data-testid="`vue-scheduled-cron-preset-${preset.id}`"
          @click="applyCronPreset(preset)"
        >
          {{ preset.label }}
        </button>
      </section>
      <label v-else>
        <span>{{ t("scheduledTasks.fields.runAt") }}</span>
        <input
          v-model="runAtLocal"
          data-testid="vue-scheduled-run-at"
          type="datetime-local"
        >
      </label>
      <label>
        <span>时区</span>
        <select v-model="timezone" data-testid="vue-scheduled-timezone">
          <option v-for="zone in timezoneOptions" :key="zone" :value="zone">
            {{ zone }}
          </option>
        </select>
      </label>
      <p class="scheduled-create__preview" data-testid="vue-scheduled-preview">
        {{ createSchedulePreview }}
      </p>
      <p class="scheduled-create__preview" data-testid="vue-scheduled-timezone-affordance">
        {{ createTimezoneAffordance }}
      </p>
      <small v-if="threadId" data-testid="vue-scheduled-thread-scope">
        复用对话 {{ threadId }}
      </small>
      <a-alert
        v-if="formError"
        :id="formErrorId"
        data-testid="vue-scheduled-form-error"
        role="alert"
        type="error"
        show-icon
        :message="formError"
      />
      <a-button
        html-type="submit"
        type="primary"
        :loading="isActionPending"
        data-testid="vue-scheduled-submit"
      >
        {{ t("scheduledTasks.create.submit") }}
      </a-button>
    </form>
    </div>

    <section class="scheduled-filters" data-testid="vue-scheduled-filters">
      <button
        type="button"
        :class="{ 'scheduled-create__type-button--active': statusFilter === 'all' }"
        data-testid="vue-scheduled-filter-status-all"
        v-bind="{ [(['aria', 'label'].join('-'))]: 'All' }"
        @click="statusFilter = 'all'"
      >
        全部状态
      </button>
      <button
        type="button"
        :class="{ 'scheduled-create__type-button--active': statusFilter === 'enabled' }"
        data-testid="vue-scheduled-filter-status-enabled"
        v-bind="{ [(['aria', 'label'].join('-'))]: 'Enabled' }"
        @click="statusFilter = 'enabled'"
      >
        已启用
      </button>
      <button
        type="button"
        :class="{ 'scheduled-create__type-button--active': statusFilter === 'paused' }"
        data-testid="vue-scheduled-filter-status-paused"
        v-bind="{ [(['aria', 'label'].join('-'))]: 'Paused' }"
        @click="statusFilter = 'paused'"
      >
        已暂停
      </button>
      <button
        type="button"
        :class="{ 'scheduled-create__type-button--active': statusFilter === 'failed' }"
        data-testid="vue-scheduled-filter-status-failed"
        v-bind="{ [(['aria', 'label'].join('-'))]: 'Failed' }"
        @click="statusFilter = 'failed'"
      >
        失败
      </button>
      <button
        type="button"
        :class="{ 'scheduled-create__type-button--active': typeFilter === 'all' }"
        data-testid="vue-scheduled-filter-type-all"
        @click="typeFilter = 'all'"
      >
        全部类型
      </button>
      <button
        type="button"
        :class="{ 'scheduled-create__type-button--active': typeFilter === 'cron' }"
        data-testid="vue-scheduled-filter-type-cron"
        @click="typeFilter = 'cron'"
      >
        Cron
      </button>
      <button
        type="button"
        :class="{ 'scheduled-create__type-button--active': typeFilter === 'once' }"
        data-testid="vue-scheduled-filter-type-once"
        @click="typeFilter = 'once'"
      >
        单次
      </button>
    </section>

    <section class="scheduled-layout">
      <section class="scheduled-list" data-testid="vue-scheduled-task-list">
        <a-spin v-if="query.isLoading.value" role="status" />
        <a-empty v-else-if="tasks.length === 0" description="暂无计划任务" />
        <a-empty v-else-if="filteredTasks.length === 0" description="没有匹配的计划任务" />
        <template v-else>
          <div
            v-for="task in filteredTasks"
            :key="task.id"
            :data-testid="`scheduled-task-item-${task.id}`"
            class="scheduled-list__item-hit-area"
          >
            <button
              type="button"
              class="scheduled-list__item"
              :class="{ 'scheduled-list__item--active': task.id === selectedTaskId }"
              :data-testid="`vue-scheduled-task-${task.id}`"
              @click="selectedTaskId = task.id"
            >
              <strong>{{ task.title }}</strong>
              <span>
                {{ scheduleSummary(task) }} · {{ task.status === "paused" ? "Paused" : task.status }}
              </span>
            </button>
          </div>
        </template>
      </section>

      <section class="scheduled-detail" data-testid="vue-scheduled-detail">
      <div data-testid="scheduled-task-detail">
        <template v-if="visibleSelectedTask">
          <div class="scheduled-detail__title-row">
            <h2>{{ visibleSelectedTask.title }}</h2>
            <a-button
              :disabled="visibleSelectedTask.status === 'running' || isActionPending"
              data-testid="vue-scheduled-edit-toggle"
              @click="isEditing = !isEditing"
            >
              {{ isEditing ? "取消编辑" : "编辑" }}
            </a-button>
          </div>
          <p v-if="!isEditing">{{ visibleSelectedTask.prompt }}</p>
          <dl>
            <dt>状态</dt>
            <dd>{{ formatTaskStatusLabel(visibleSelectedTask.status) }}</dd>
            <dt>下次运行</dt>
            <dd>{{ formatTaskTimestamp(visibleSelectedTask.next_run_at, visibleSelectedTask.timezone) }}</dd>
            <dt>租约</dt>
            <dd>{{ formatTaskTimestamp(visibleSelectedTask.lease_expires_at, visibleSelectedTask.timezone) }}</dd>
            <dt>租约持有者</dt>
            <dd>{{ visibleSelectedTask.lease_owner || "无" }}</dd>
            <dt>重叠策略</dt>
            <dd>{{ visibleSelectedTask.overlap_policy }}</dd>
            <dt>运行次数</dt>
            <dd>{{ visibleSelectedTask.run_count }}</dd>
            <dt>上次运行</dt>
            <dd>{{ visibleSelectedTask.last_run_id || "无" }}</dd>
            <dt>上次对话</dt>
            <dd>{{ visibleSelectedTask.last_thread_id || "无" }}</dd>
            <dt>上次错误</dt>
            <dd>{{ visibleSelectedTask.last_error || "无" }}</dd>
          </dl>
          <form
            v-if="isEditing"
            class="scheduled-edit"
            data-testid="vue-scheduled-edit-form"
            @submit.prevent="submitEditTask"
          >
            <label>
              <span>标题</span>
              <input
                v-model="editTitle"
                data-testid="vue-scheduled-edit-title"
              >
            </label>
            <label>
              <span>提示词</span>
              <textarea
                v-model="editPrompt"
                data-testid="vue-scheduled-edit-prompt"
              />
            </label>
            <label v-if="visibleSelectedTask.schedule_type === 'cron'">
              <span>Cron</span>
              <input
                v-model="editCron"
                data-testid="vue-scheduled-edit-cron"
              >
            </label>
            <label v-else>
              <span>运行时间</span>
              <input
                v-model="editRunAtLocal"
                data-testid="vue-scheduled-edit-run-at"
                type="datetime-local"
              >
            </label>
            <label>
              <span>时区</span>
              <select v-model="editTimezone" data-testid="vue-scheduled-edit-timezone">
                <option v-for="zone in timezoneOptions" :key="zone" :value="zone">
                  {{ zone }}
                </option>
              </select>
            </label>
            <p class="scheduled-create__preview" data-testid="vue-scheduled-edit-preview">
              {{ editSchedulePreview }}
            </p>
            <p class="scheduled-create__preview" data-testid="vue-scheduled-edit-timezone-affordance">
              {{ editTimezoneAffordance }}
            </p>
            <a-alert
              v-if="editError"
              :id="editErrorId"
              data-testid="vue-scheduled-edit-error"
              role="alert"
              type="error"
              show-icon
              :message="editError"
            />
            <a-button
              html-type="submit"
              type="primary"
              :loading="isActionPending"
              data-testid="vue-scheduled-edit-submit"
            >
              保存修改
            </a-button>
          </form>
          <div class="scheduled-detail__actions">
            <a-button
              :disabled="visibleSelectedTask.status === 'running' || isActionPending"
              data-testid="vue-scheduled-pause"
              @click="pauseSelectedTask"
            >
              {{ t("scheduledTasks.actions.pause") }}
            </a-button>
            <a-button
              :disabled="visibleSelectedTask.status === 'running' || isActionPending"
              data-testid="vue-scheduled-resume"
              @click="resumeSelectedTask"
            >
              恢复
            </a-button>
            <a-button
              :disabled="isActionPending"
              data-testid="vue-scheduled-trigger"
              @click="triggerSelectedTask"
            >
              {{ t("scheduledTasks.actions.trigger") }}
            </a-button>
            <a-button
              danger
              :disabled="visibleSelectedTask.status === 'running' || isActionPending"
              data-testid="vue-scheduled-delete"
              @click="deleteSelectedTask"
            >
              删除
            </a-button>
          </div>
          <section class="scheduled-runs" data-testid="vue-scheduled-runs">
          <div data-testid="scheduled-task-runs">
            <h3>运行记录 · {{ runs.length }} {{ runs.length === 1 ? "run" : "runs" }}</h3>
            <a-spin v-if="runsQuery.isLoading.value" role="status" />
            <a-empty v-else-if="runs.length === 0" description="暂无运行记录" />
            <ul v-else data-testid="scheduled-task-run-list">
              <li v-for="run in runs" :key="run.id">
                <strong>{{ formatRunStatusLabel(run.status) }}</strong>
                · {{ formatRunTriggerLabel(run.trigger) }}
                · {{ run.trigger === "manual" ? "Manual" : "Scheduled" }} · {{ run.status === "success" ? "Success" : run.status }}
                · 计划时间 {{ formatTaskTimestamp(run.scheduled_for, visibleSelectedTask.timezone) }}
                <span v-if="run.run_id"> · 运行 {{ run.run_id }}</span>
                <span v-if="run.started_at"> · 开始 {{ formatTaskTimestamp(run.started_at, visibleSelectedTask.timezone) }}</span>
                <span v-if="run.finished_at"> · 结束 {{ formatTaskTimestamp(run.finished_at, visibleSelectedTask.timezone) }}</span>
                <span v-if="run.error"> · {{ run.error }}</span>
              </li>
            </ul>
          </div>
          </section>
        </template>
        <a-empty v-else description="未选择计划任务" />
      </div>
      </section>
    </section>
  </section>
  </WorkspaceNavShell>
</template>
