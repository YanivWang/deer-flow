import type { ScheduledTaskPayload } from "../../../core/api/scheduled-tasks/client";
import { normalizeDatetimeLocalForSchedule } from "../../../entities/scheduled-task/model";

export function buildCreateScheduledTaskPayload(input: {
  contextThreadId: string | null;
  prompt: string;
  runAtLocal: string;
  scheduleType: "cron" | "once";
  cron: string;
  timezone: string;
  title: string;
}): { payload: ScheduledTaskPayload } | { error: string } {
  const title = input.title.trim();
  const prompt = input.prompt.trim();
  const cron = input.cron.trim();
  const runAtLocal = input.runAtLocal.trim();
  const timezone = input.timezone.trim() || "UTC";
  if (!title || !prompt) return { error: "标题和提示词为必填项。" };
  if (input.scheduleType === "cron" && !cron) return { error: "Cron 计划为必填项。" };
  if (input.scheduleType === "once" && !runAtLocal) return { error: "运行日期和时间为必填项。" };
  const scheduleSpec = input.scheduleType === "cron" ? { cron } : buildOnceScheduleSpec(runAtLocal);
  if (!scheduleSpec) return { error: "运行日期和时间无效。" };
  return {
    payload: {
      context_mode: input.contextThreadId ? "reuse_thread" : "fresh_thread_per_run",
      ...(input.contextThreadId ? { thread_id: input.contextThreadId } : {}),
      prompt,
      schedule_spec: scheduleSpec,
      schedule_type: input.scheduleType,
      timezone,
      title,
    },
  };
}

function buildOnceScheduleSpec(value: string): { run_at: string } | null {
  const runAt = normalizeDatetimeLocalForSchedule(value);
  return runAt ? { run_at: runAt } : null;
}
