import { appendCsrfHeader } from "../csrf";

export type ScheduledTask = {
  id: string;
  thread_id: string | null;
  context_mode: "fresh_thread_per_run" | "reuse_thread";
  title: string;
  prompt: string;
  schedule_type: "once" | "cron";
  schedule_spec: Record<string, unknown>;
  timezone: string;
  status: "enabled" | "paused" | "running" | "completed" | "failed" | "cancelled";
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_id: string | null;
  last_thread_id: string | null;
  last_error: string | null;
  lease_expires_at: string | null;
  lease_owner: string | null;
  overlap_policy: "skip";
  run_count: number;
  created_at: string;
  updated_at: string;
};

export type ScheduledTaskRun = {
  id: string;
  task_id: string;
  thread_id: string;
  run_id: string | null;
  scheduled_for: string;
  trigger: "scheduled" | "manual";
  status: "queued" | "running" | "success" | "failed" | "skipped" | "interrupted";
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

export type ScheduledTaskPayload = {
  context_mode: "fresh_thread_per_run" | "reuse_thread";
  thread_id?: string | null;
  title: string;
  prompt: string;
  schedule_type: "once" | "cron";
  schedule_spec: Record<string, unknown>;
  timezone: string;
};

export type ScheduledTaskUpdatePayload = Partial<
  Pick<
    ScheduledTaskPayload,
    "context_mode" | "prompt" | "schedule_spec" | "thread_id" | "timezone" | "title"
  >
>;

export async function fetchScheduledTasks(
  input: { threadId?: string | null } = {},
): Promise<ScheduledTask[]> {
  const path = input.threadId
    ? `/api/threads/${encodeURIComponent(input.threadId)}/scheduled-tasks`
    : "/api/scheduled-tasks";
  return fetchScheduledTaskJson<ScheduledTask[]>(path);
}

export async function createScheduledTask(payload: ScheduledTaskPayload): Promise<ScheduledTask> {
  return fetchScheduledTaskJson<ScheduledTask>("/api/scheduled-tasks", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export async function updateScheduledTask(
  taskId: string,
  payload: ScheduledTaskUpdatePayload,
): Promise<ScheduledTask> {
  return fetchScheduledTaskJson<ScheduledTask>(
    `/api/scheduled-tasks/${encodeURIComponent(taskId)}`,
    {
      body: JSON.stringify(payload),
      method: "PATCH",
    },
  );
}

export async function fetchScheduledTaskRuns(taskId: string): Promise<ScheduledTaskRun[]> {
  return fetchScheduledTaskJson<ScheduledTaskRun[]>(
    `/api/scheduled-tasks/${encodeURIComponent(taskId)}/runs`,
  );
}

export async function pauseScheduledTask(taskId: string): Promise<ScheduledTask> {
  return mutateScheduledTask(taskId, "pause");
}

export async function resumeScheduledTask(taskId: string): Promise<ScheduledTask> {
  return mutateScheduledTask(taskId, "resume");
}

export async function triggerScheduledTask(
  taskId: string,
): Promise<{ id: string; triggered: boolean }> {
  return fetchScheduledTaskJson<{ id: string; triggered: boolean }>(
    `/api/scheduled-tasks/${encodeURIComponent(taskId)}/trigger`,
    { method: "POST" },
  );
}

export async function deleteScheduledTask(
  taskId: string,
): Promise<{ id: string; deleted: boolean }> {
  return fetchScheduledTaskJson<{ id: string; deleted: boolean }>(
    `/api/scheduled-tasks/${encodeURIComponent(taskId)}`,
    { method: "DELETE" },
  );
}

function mutateScheduledTask(taskId: string, action: "pause" | "resume"): Promise<ScheduledTask> {
  return fetchScheduledTaskJson<ScheduledTask>(
    `/api/scheduled-tasks/${encodeURIComponent(taskId)}/${action}`,
    { method: "POST" },
  );
}

async function fetchScheduledTaskJson<T>(
  path: string,
  init: Omit<RequestInit, "headers"> & { headers?: HeadersInit } = {},
): Promise<T> {
  const method = init.method ?? "GET";
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: buildHeaders(init.headers, method),
  });
  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response, "计划任务请求失败。"));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function buildHeaders(headers: HeadersInit | undefined, method: string): Headers {
  const nextHeaders = new Headers(headers);
  if (method.toUpperCase() !== "GET" && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }
  return appendCsrfHeader(nextHeaders, method);
}

async function readResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return fallback;
  }
  return formatResponseErrorDetail(isRecord(payload) ? payload.detail : undefined) ?? fallback;
}

function formatResponseErrorDetail(detail: unknown): string | undefined {
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }
  if (isRecord(detail) && typeof detail.message === "string" && detail.message.trim()) {
    return detail.message.trim();
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
