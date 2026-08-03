import type {
  ScheduledTask,
  ScheduledTaskRun,
} from "../../core/api/scheduled-tasks/client";

export type CronBuilderMode = "hourly" | "daily" | "weekdays" | "weekly" | "monthly";

export type CronBuilderModeOption = {
  label: string;
  value: CronBuilderMode;
};

export type ScheduleRecipe = {
  id: string;
  title: string;
  prompt: string;
  cron: string;
  timezone?: string;
};

export type CronPreset = {
  id: string;
  label: string;
  cron: string;
};

export const SCHEDULE_RECIPES: ScheduleRecipe[] = [
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

export const CRON_PRESETS: CronPreset[] = [
  { cron: "0 9 * * *", id: "daily-9", label: "每天 09:00" },
  { cron: "0 9 * * 1-5", id: "weekdays-9", label: "工作日 09:00" },
  { cron: "0 9 * * 1", id: "weekly-monday-9", label: "周一 09:00" },
  { cron: "0 * * * *", id: "hourly", label: "每小时" },
];

export const CRON_BUILDER_MODES: CronBuilderModeOption[] = [
  { label: "每小时", value: "hourly" },
  { label: "每天", value: "daily" },
  { label: "工作日", value: "weekdays" },
  { label: "每周", value: "weekly" },
  { label: "每月", value: "monthly" },
];

export const CRON_WEEKDAYS = [
  { label: "周日", value: "0" },
  { label: "周一", value: "1" },
  { label: "周二", value: "2" },
  { label: "周三", value: "3" },
  { label: "周四", value: "4" },
  { label: "周五", value: "5" },
  { label: "周六", value: "6" },
];

export const CRON_MONTH_DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1));

export const FALLBACK_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function scheduleSummary(task: ScheduledTask): string {
  const spec = task.schedule_spec;
  const schedule =
    task.schedule_type === "cron"
      ? readString(spec.cron) ?? "cron"
      : readString(spec.run_at) ?? "单次";
  return `${task.schedule_type === "cron" ? "cron" : "单次"} · ${schedule} · ${formatTaskStatusLabel(task.status)}`;
}

export function buildCronFromBuilder(input: {
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

export function cronBuilderFromExpression(expression: string): {
  minute: string;
  hour: string;
  mode: CronBuilderMode;
  weekday: string;
  monthDay: string;
} | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek || month !== "*") {
    return null;
  }

  const normalizedMinute = normalizeCronNumber(minute, 0, 59);
  if (!normalizedMinute) {
    return null;
  }
  if (hour === "*" && dayOfMonth === "*" && dayOfWeek === "*") {
    return { hour: "09", minute: normalizedMinute, mode: "hourly", monthDay: "1", weekday: "1" };
  }

  const normalizedHour = normalizeCronNumber(hour, 0, 23);
  if (!normalizedHour) {
    return null;
  }
  const base = {
    hour: normalizedHour.padStart(2, "0"),
    minute: normalizedMinute,
    monthDay: "1",
    weekday: "1",
  };
  if (dayOfMonth === "*" && dayOfWeek === "*") {
    return { ...base, mode: "daily" };
  }
  if (dayOfMonth === "*" && dayOfWeek === "1-5") {
    return { ...base, mode: "weekdays" };
  }
  if (dayOfMonth === "*") {
    const weekday = normalizeCronNumber(dayOfWeek, 0, 6);
    return weekday ? { ...base, mode: "weekly", weekday } : null;
  }
  const monthDay = normalizeCronNumber(dayOfMonth, 1, 31);
  return dayOfWeek === "*" && monthDay ? { ...base, mode: "monthly", monthDay } : null;
}

export function normalizeDatetimeLocalForSchedule(value: string): string | null {
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
  if (
    Number.isNaN(parsed.getTime()) ||
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

export function toLocalDatetimeInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function formatSchedulePreview(input: {
  cron: string;
  runAtLocal: string;
  scheduleType: "cron" | "once";
  timezone: string;
}): string {
  const timezone = input.timezone.trim() || "UTC";
  if (input.scheduleType === "cron") {
    return `cron · ${formatCronPreview(input.cron.trim())} · ${timezone}`;
  }
  const runAt = normalizeDatetimeLocalForSchedule(input.runAtLocal.trim());
  return `单次 · ${runAt ? formatWallClockPreview(runAt) : "尚无有效运行时间"} · ${timezone}`;
}

export function formatTimezoneAffordance(input: {
  cron: string;
  runAtLocal: string;
  scheduleType: "cron" | "once";
  timezone: string;
}): string {
  const timezone = input.timezone.trim() || "UTC";
  if (input.scheduleType === "cron") {
    return `Gateway 会按 ${timezone} 评估这个 5 字段 Cron；存储的 next_run_at 会规范化为 UTC。`;
  }
  const runAt = normalizeDatetimeLocalForSchedule(input.runAtLocal.trim());
  if (!runAt) {
    return `请选择日历时间；Gateway 会按 ${timezone} 的墙钟时间处理。`;
  }
  return `Gateway 会收到不带偏移量的 ${runAt}，并将其解释为 ${formatWallClockSentence(runAt, timezone)}。`;
}

export function formatTaskTimestamp(value: string | null, timezone: string): string {
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
    timeZone: timezone || "UTC",
  }).format(date);
}

export function formatTaskStatusLabel(status: ScheduledTask["status"]): string {
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

export function formatRunStatusLabel(status: ScheduledTaskRun["status"]): string {
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

export function formatRunTriggerLabel(trigger: ScheduledTaskRun["trigger"]): string {
  return trigger === "manual" ? "手动触发" : "计划触发";
}

export function detectBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}

function formatCronPreview(cronExpression: string): string {
  if (!cronExpression) {
    return "空表达式";
  }
  const parts = cronExpression.split(/\s+/).filter(Boolean);
  if (parts.length !== 5) {
    return `${cronExpression}（应为 5 个字段）`;
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
    return `${cronExpression}（应为 5 个字段）`;
  }
  const recognized = describeRecognizedCron(minute, hour, dayOfMonth, month, dayOfWeek);
  return recognized
    ? `${recognized} (${cronExpression})`
    : `分钟 ${minute}，小时 ${hour}，日期 ${dayOfMonth}，月份 ${month}，星期 ${dayOfWeek}`;
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

function formatCronTime(hour: string, minute: string): string | null {
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) {
    return null;
  }
  const numericHour = Number(hour);
  const numericMinute = Number(minute);
  return numericHour <= 23 && numericMinute <= 59
    ? `${String(numericHour).padStart(2, "0")}:${String(numericMinute).padStart(2, "0")}`
    : null;
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

function formatWallClockPreview(value: string): string {
  return value.replace("T", " ").replace(/:00$/, "");
}

function formatWallClockSentence(value: string, timezone: string): string {
  const datePart = value.slice(0, 10);
  const timePart = value.slice(11, 16);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) {
    return `${timezone} 的所选日期 ${datePart} ${timePart}`;
  }
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(new Date(timestamp));
  return `${timezone} 的 ${weekday} ${datePart} ${timePart}`;
}

function normalizeCronNumber(value: string, min: number, max: number): string | null {
  if (!/^\d{1,2}$/.test(value)) {
    return null;
  }
  const numeric = Number(value);
  return numeric >= min && numeric <= max ? String(numeric) : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
