import type { ScheduledTask, ScheduledTaskUpdatePayload } from "../../../core/api/scheduled-tasks/client";
import { normalizeDatetimeLocalForSchedule } from "../../../entities/scheduled-task/model";

export function buildEditScheduledTaskPayload(input: {
  task: ScheduledTask;
  title: string;
  prompt: string;
  cron: string;
  runAtLocal: string;
  timezone: string;
}): { payload: ScheduledTaskUpdatePayload } | { error: string } {
  const title = input.title.trim();
  const prompt = input.prompt.trim();
  const timezone = input.timezone.trim() || "UTC";
  if (!title || !prompt) return { error: "标题和提示词为必填项。" };
  const scheduleSpec = input.task.schedule_type === "cron"
    ? input.cron.trim() ? { cron: input.cron.trim() } : null
    : buildOnceScheduleSpec(input.runAtLocal.trim());
  if (!scheduleSpec) {
    return { error: input.task.schedule_type === "cron" ? "Cron 计划为必填项。" : "运行日期和时间无效。" };
  }
  return { payload: { prompt, schedule_spec: scheduleSpec, timezone, title } };
}

function buildOnceScheduleSpec(value: string): { run_at: string } | null {
  const runAt = normalizeDatetimeLocalForSchedule(value);
  return runAt ? { run_at: runAt } : null;
}
