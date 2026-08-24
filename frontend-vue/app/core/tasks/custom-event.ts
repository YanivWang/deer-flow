/*
  【文件职责】     将 task_*、llm_retry 与 replay-gap custom 事件归约为 thread UI 状态。
  【架构位置】     L3
  【主要导出】     reduceThreadCustomEvent · create/clear helpers
  【依赖关系】     tasks/lifecycle · steps · subtask-update
  【边界与注意】   message_index 去重排序，usage 单调，终态不被迟到进度回滚。
*/
import { normalizeTokenUsage } from "@/core/messages/usage";
import { taskEventToSubtaskUpdate } from "./lifecycle";
import { messageToStep } from "./steps";
import { computeNextSubtask, isTerminalSubtaskStatus } from "./subtask-update";
import type { Subtask } from "./types";

export interface LlmRetryNotice {
  attempt: number;
  maxAttempts: number;
  waitMs: number;
  reason: string;
  message: string;
}

export interface ThreadCustomEventState {
  tasks: Record<string, Subtask>;
  retry: LlmRetryNotice | null;
}

export type ThreadCustomEventEffect = "none" | "replay_gap";

export interface ThreadCustomEventReduction {
  state: ThreadCustomEventState;
  effect: ThreadCustomEventEffect;
}

export function createThreadCustomEventState(): ThreadCustomEventState {
  return { tasks: {}, retry: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function baseSubtask(id: string): Subtask {
  return {
    id,
    status: "in_progress",
    subagent_type: "",
    description: "Subtask",
    prompt: "",
  };
}

function updateTask(
  state: ThreadCustomEventState,
  update: Partial<Subtask> & { id: string },
): ThreadCustomEventState {
  const previous = state.tasks[update.id];
  const transition = computeNextSubtask(previous ?? baseSubtask(update.id), {
    ...update,
    id: update.id,
  });
  if (!transition.changed) return state;
  return {
    ...state,
    tasks: { ...state.tasks, [update.id]: transition.next },
  };
}

function retryNotice(event: Record<string, unknown>): LlmRetryNotice | null {
  const attempt = nonNegativeInteger(event.attempt);
  const maxAttempts = nonNegativeInteger(event.max_attempts);
  const waitMs = nonNegativeInteger(event.wait_ms);
  const reason = nonEmptyString(event.reason);
  const message = nonEmptyString(event.message);
  if (
    attempt === undefined ||
    maxAttempts === undefined ||
    waitMs === undefined ||
    !reason ||
    !message
  ) {
    return null;
  }
  return { attempt, maxAttempts, waitMs, reason, message };
}

function terminalTaskUpdate(
  event: Record<string, unknown>,
  taskId: string,
): (Partial<Subtask> & { id: string }) | null {
  const type = event.type;
  if (
    type !== "task_completed" &&
    type !== "task_failed" &&
    type !== "task_cancelled" &&
    type !== "task_timed_out"
  ) {
    return null;
  }
  const modelName = nonEmptyString(event.model_name);
  const usage = normalizeTokenUsage(event.usage);
  if (type === "task_completed") {
    return {
      id: taskId,
      status: "completed",
      ...(nonEmptyString(event.result)
        ? { result: nonEmptyString(event.result) }
        : {}),
      ...(modelName ? { modelName } : {}),
      ...(usage ? { usage } : {}),
    };
  }
  const fallback =
    type === "task_cancelled"
      ? "Subtask cancelled."
      : type === "task_timed_out"
        ? "Subtask timed out."
        : "Subtask failed.";
  return {
    id: taskId,
    status: "failed",
    error: nonEmptyString(event.error) ?? fallback,
    ...(modelName ? { modelName } : {}),
    ...(usage ? { usage } : {}),
  };
}

/**
 * Fold task lifecycle, retry and replay-gap custom events in one pure reducer.
 * Task steps are deltas keyed by message_index; terminal state never rolls back.
 */
export function reduceThreadCustomEvent(
  state: ThreadCustomEventState,
  event: unknown,
): ThreadCustomEventReduction {
  if (!isRecord(event)) return { state, effect: "none" };
  if (event.type === "stream_replay_gap") {
    return { state: createThreadCustomEventState(), effect: "replay_gap" };
  }
  if (event.type === "llm_retry") {
    const retry = retryNotice(event);
    if (!retry) return { state, effect: "none" };
    return { state: { ...state, retry }, effect: "none" };
  }

  const taskId = nonEmptyString(event.task_id);
  if (!taskId) return { state, effect: "none" };
  const previous = state.tasks[taskId];
  const terminal = terminalTaskUpdate(event, taskId);
  if (terminal) {
    const progressState = clearThreadRetryNotice(state);
    const terminalUpdate =
      previous && isTerminalSubtaskStatus(previous.status)
        ? { ...terminal, status: previous.status }
        : terminal;
    return {
      state: updateTask(progressState, terminalUpdate),
      effect: "none",
    };
  }

  const lifecycle = taskEventToSubtaskUpdate(event);
  const hasRunningMessage =
    event.type === "task_running" && isRecord(event.message);
  if (!lifecycle && !hasRunningMessage) return { state, effect: "none" };
  const progressState = clearThreadRetryNotice(state);
  const description = nonEmptyString(event.description);
  const subagentType = nonEmptyString(event.subagent_type);
  const prompt = nonEmptyString(event.prompt);
  const update: Partial<Subtask> & { id: string } = {
    ...(lifecycle ?? {}),
    id: taskId,
    status: "in_progress",
    ...(description ? { description } : {}),
    ...(subagentType ? { subagent_type: subagentType } : {}),
    ...(prompt ? { prompt } : {}),
  };

  if (event.type === "task_running" && isRecord(event.message)) {
    const messageIndex = nonNegativeInteger(event.message_index) ?? 0;
    const alreadySeen = previous?.steps?.some(
      (step) => step.message_index === messageIndex,
    );
    if (Reflect.get(event.message, "type") === "ai") {
      update.latestMessage = event.message as NonNullable<
        Subtask["latestMessage"]
      >;
    }
    if (!alreadySeen) {
      update.steps = [messageToStep(event.message, messageIndex)];
    }
  }
  return { state: updateTask(progressState, update), effect: "none" };
}

export function clearThreadRetryNotice(
  state: ThreadCustomEventState,
): ThreadCustomEventState {
  return state.retry ? { ...state, retry: null } : state;
}
