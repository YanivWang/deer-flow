/*
  【文件职责】     Scheduled-task 表单状态、Gateway payload 与 DST 严格转换的纯逻辑。
  【架构位置】     L3 scheduled-task application core
  【主要导出】     ScheduledTaskDraft 与 create/edit/recipe/payload 转换函数
  【依赖关系】     cron · recipes · schedule · types · api payload types
  【边界与注意】   Gateway 仅支持 once/cron；fresh payload 不携带 thread_id；PATCH 不携带 schedule_type。
*/
import type {
  ScheduledTaskCreatePayload,
  ScheduledTaskUpdatePayload,
} from "./api";
import { utcToZonedLocalInput, zonedLocalToUtcIso } from "./cron";
import type { Recipe } from "./recipes";
import type { ScheduleValue } from "./schedule";
import type { ScheduledTask } from "./types";

export type ScheduledTaskContextMode = "fresh_thread_per_run" | "reuse_thread";

export type ScheduledTaskDraft = {
  contextMode: ScheduledTaskContextMode;
  threadId: string;
  title: string;
  prompt: string;
  schedule: ScheduleValue;
};

export type PayloadBuildOptions = {
  now?: Date;
};

export class ScheduledTaskFormError extends Error {
  constructor(
    readonly code:
      | "invalid_datetime"
      | "invalid_timezone"
      | "missing_thread"
      | "past_datetime"
      | "schedule_type_changed"
      | "required",
    message: string,
  ) {
    super(message);
    this.name = "ScheduledTaskFormError";
  }
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function cloneSchedule(schedule: ScheduleValue): ScheduleValue {
  return {
    schedule_type: schedule.schedule_type,
    schedule_spec: { ...schedule.schedule_spec },
    timezone: schedule.timezone,
  };
}

export function createScheduledTaskDraft(
  options: {
    routeThreadId?: string | null;
    browserTimezone?: string;
  } = {},
): ScheduledTaskDraft {
  const routeThreadId = options.routeThreadId?.trim() ?? "";
  return {
    contextMode: routeThreadId ? "reuse_thread" : "fresh_thread_per_run",
    threadId: routeThreadId,
    title: "",
    prompt: "",
    schedule: {
      schedule_type: "cron",
      schedule_spec: { cron: "0 9 * * *" },
      timezone: options.browserTimezone || browserTimezone(),
    },
  };
}

export function draftForScheduledTask(task: ScheduledTask): ScheduledTaskDraft {
  const scheduleSpec = { ...task.schedule_spec } as {
    cron?: string;
    run_at?: string;
  };
  if (task.schedule_type === "once" && scheduleSpec.run_at) {
    scheduleSpec.run_at = utcToZonedLocalInput(
      scheduleSpec.run_at,
      task.timezone,
    );
  }
  return {
    contextMode: task.context_mode,
    threadId: task.thread_id ?? "",
    title: task.title,
    prompt: task.prompt,
    schedule: {
      schedule_type: task.schedule_type,
      schedule_spec: scheduleSpec,
      timezone: task.timezone,
    },
  };
}

export function applyScheduledTaskRecipe(
  draft: ScheduledTaskDraft,
  recipe: Recipe,
  localizedTitle: string,
): ScheduledTaskDraft {
  const schedule = cloneSchedule(recipe.schedule);
  schedule.timezone = schedule.timezone || draft.schedule.timezone;
  return {
    contextMode: "fresh_thread_per_run",
    threadId: "",
    title: localizedTitle,
    prompt: recipe.prompt,
    schedule,
  };
}

function assertLocalDateTime(value: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new ScheduledTaskFormError(
      "invalid_datetime",
      "Run time must be a valid local date and time.",
    );
  }
  const [, year, month, day, hour, minute] = match.map(Number);
  const checked = new Date(Date.UTC(year!, month! - 1, day!, hour!, minute!));
  if (
    checked.getUTCFullYear() !== year ||
    checked.getUTCMonth() + 1 !== month ||
    checked.getUTCDate() !== day ||
    checked.getUTCHours() !== hour ||
    checked.getUTCMinutes() !== minute
  ) {
    throw new ScheduledTaskFormError(
      "invalid_datetime",
      "Run time must be a valid local date and time.",
    );
  }
}

export function zonedLocalToUtcIsoStrict(
  localValue: string,
  timezone: string,
): string {
  const normalized = localValue.trim();
  assertLocalDateTime(normalized);
  let utcIso: string;
  try {
    utcIso = zonedLocalToUtcIso(normalized, timezone);
    if (utcToZonedLocalInput(utcIso, timezone) !== normalized) {
      throw new ScheduledTaskFormError(
        "invalid_datetime",
        `The selected local time does not exist in ${timezone}.`,
      );
    }
  } catch (cause) {
    if (cause instanceof ScheduledTaskFormError) throw cause;
    throw new ScheduledTaskFormError(
      "invalid_timezone",
      `Unknown timezone: ${timezone}.`,
    );
  }
  return utcIso;
}

function basePayload(draft: ScheduledTaskDraft): {
  context_mode: ScheduledTaskContextMode;
  thread_id?: string;
  title: string;
  prompt: string;
  timezone: string;
} {
  const title = draft.title.trim();
  const prompt = draft.prompt.trim();
  if (!title || !prompt) {
    throw new ScheduledTaskFormError(
      "required",
      "Title and prompt are required.",
    );
  }
  const payload = {
    context_mode: draft.contextMode,
    title,
    prompt,
    timezone: draft.schedule.timezone.trim(),
  } as {
    context_mode: ScheduledTaskContextMode;
    thread_id?: string;
    title: string;
    prompt: string;
    timezone: string;
  };
  if (draft.contextMode === "reuse_thread") {
    const threadId = draft.threadId.trim();
    if (!threadId) {
      throw new ScheduledTaskFormError(
        "missing_thread",
        "A thread is required when reusing context.",
      );
    }
    payload.thread_id = threadId;
  }
  return payload;
}

function scheduleSpec(
  draft: ScheduledTaskDraft,
  now: Date,
): Record<string, unknown> {
  if (draft.schedule.schedule_type === "cron") {
    return { cron: (draft.schedule.schedule_spec.cron ?? "").trim() };
  }
  const runAt = zonedLocalToUtcIsoStrict(
    draft.schedule.schedule_spec.run_at ?? "",
    draft.schedule.timezone,
  );
  if (new Date(runAt).getTime() <= now.getTime()) {
    throw new ScheduledTaskFormError(
      "past_datetime",
      "Run time must be in the future.",
    );
  }
  return { run_at: runAt };
}

export function buildScheduledTaskCreatePayload(
  draft: ScheduledTaskDraft,
  options: PayloadBuildOptions = {},
): ScheduledTaskCreatePayload {
  const base = basePayload(draft);
  return {
    ...base,
    schedule_type: draft.schedule.schedule_type,
    schedule_spec: scheduleSpec(draft, options.now ?? new Date()),
  };
}

export function buildScheduledTaskUpdatePayload(
  draft: ScheduledTaskDraft,
  task: ScheduledTask,
  options: PayloadBuildOptions = {},
): ScheduledTaskUpdatePayload {
  if (draft.schedule.schedule_type !== task.schedule_type) {
    throw new ScheduledTaskFormError(
      "schedule_type_changed",
      "The schedule type cannot be changed while editing.",
    );
  }
  return {
    ...basePayload(draft),
    schedule_spec: scheduleSpec(draft, options.now ?? new Date()),
  };
}
