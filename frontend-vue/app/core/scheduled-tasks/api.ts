/*
  【文件职责】     Scheduled-task list/detail/runs 与 mutation 的 Gateway HTTP adapter。
  【架构位置】     L3 scheduled-task API boundary
  【主要导出】     ScheduledTaskCreatePayload · ScheduledTaskUpdatePayload · scheduled-task API functions
  【依赖关系】     core api fetcher/errors/config · scheduled-task types
  【边界与注意】   Gateway 只支持 once/cron；PATCH 不发送 schedule_type；runs 不带分页参数，
                   用 Gateway 自己的 limit=50/offset=0 默认值（对照见 hooks 侧注释）。
*/
import { throwGatewayApiError } from "@/core/api/errors";
import { fetch } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";

import type { ScheduledTask, ScheduledTaskRun } from "./types";

type RequestOptions = {
  signal?: AbortSignal;
};

export type ScheduledTaskCreatePayload = {
  context_mode: "fresh_thread_per_run" | "reuse_thread";
  thread_id?: string | null;
  title: string;
  prompt: string;
  schedule_type: "once" | "cron";
  schedule_spec: Record<string, unknown>;
  timezone: string;
};

/** PATCH 不带 thread_id / schedule_type：与 React 的同名类型同一份取舍。 */
export type ScheduledTaskUpdatePayload = Partial<
  Omit<ScheduledTaskCreatePayload, "thread_id" | "schedule_type">
>;

/** Kept for callers that only need the create contract. */
export type ScheduledTaskPayload = ScheduledTaskCreatePayload;

function scheduledTasksUrl(path: string): string {
  return `${getBackendBaseURL()}/api/scheduled-tasks${path}`;
}

export async function fetchScheduledTasks(
  options: RequestOptions = {},
): Promise<ScheduledTask[]> {
  const response = await fetch(scheduledTasksUrl(""), {
    signal: options.signal,
  });
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to load scheduled tasks: ${response.statusText}`,
    );
  }
  return response.json();
}

export async function fetchThreadScheduledTasks(
  threadId: string,
  options: RequestOptions = {},
): Promise<ScheduledTask[]> {
  const response = await fetch(
    `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/scheduled-tasks`,
    { signal: options.signal },
  );
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to load thread scheduled tasks: ${response.statusText}`,
    );
  }
  return response.json();
}

export async function fetchScheduledTaskRuns(
  taskId: string,
  options: RequestOptions = {},
): Promise<ScheduledTaskRun[]> {
  const response = await fetch(
    scheduledTasksUrl(`/${encodeURIComponent(taskId)}/runs`),
    { signal: options.signal },
  );
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to load scheduled task runs: ${response.statusText}`,
    );
  }
  return response.json();
}

export async function createScheduledTask(
  payload: ScheduledTaskCreatePayload,
): Promise<ScheduledTask> {
  const response = await fetch(scheduledTasksUrl(""), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to create scheduled task: ${response.statusText}`,
    );
  }
  return response.json();
}

export async function updateScheduledTask(
  taskId: string,
  payload: ScheduledTaskUpdatePayload,
): Promise<ScheduledTask> {
  const response = await fetch(
    scheduledTasksUrl(`/${encodeURIComponent(taskId)}`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to update scheduled task: ${response.statusText}`,
    );
  }
  return response.json();
}

export async function pauseScheduledTask(
  taskId: string,
): Promise<ScheduledTask> {
  const response = await fetch(
    scheduledTasksUrl(`/${encodeURIComponent(taskId)}/pause`),
    { method: "POST" },
  );
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to pause scheduled task: ${response.statusText}`,
    );
  }
  return response.json();
}

export async function resumeScheduledTask(
  taskId: string,
): Promise<ScheduledTask> {
  const response = await fetch(
    scheduledTasksUrl(`/${encodeURIComponent(taskId)}/resume`),
    { method: "POST" },
  );
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to resume scheduled task: ${response.statusText}`,
    );
  }
  return response.json();
}

export async function triggerScheduledTask(
  taskId: string,
): Promise<{ id: string; triggered: boolean }> {
  const response = await fetch(
    scheduledTasksUrl(`/${encodeURIComponent(taskId)}/trigger`),
    { method: "POST" },
  );
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to trigger scheduled task: ${response.statusText}`,
    );
  }
  return response.json();
}

export async function deleteScheduledTask(
  taskId: string,
): Promise<{ id: string; deleted: boolean }> {
  const response = await fetch(
    scheduledTasksUrl(`/${encodeURIComponent(taskId)}`),
    {
      method: "DELETE",
    },
  );
  if (!response.ok) {
    await throwGatewayApiError(
      response,
      `Failed to delete scheduled task: ${response.statusText}`,
    );
  }
  return response.json();
}
