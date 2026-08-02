import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

import {
  clearThreadGoal,
  getThreadGoal,
  setThreadGoal,
} from "../core/api/thread/client";
import type { GoalState } from "../core/api/thread/types";

export const MAX_GOAL_OBJECTIVE_CHARS = 4000;

export type GoalContinuationDisplay = {
  count: number;
  max: number;
};

export function useThreadGoal(
  threadId: MaybeRefOrGetter<string>,
  serverGoal: MaybeRefOrGetter<GoalState | null | undefined>,
) {
  const localGoal = ref<GoalState | null | undefined>(undefined);
  const isGoalPending = ref(false);
  const goalErrorMessage = ref<string | null>(null);
  const previousThreadId = ref<string | null>(null);
  const previousServerGoalKey = ref<string | null>(null);

  watch(
    () => ({
      serverGoalKey: goalReconciliationKey(toValue(serverGoal) ?? null),
      serverGoalProvided: toValue(serverGoal) !== undefined,
      threadId: toValue(threadId),
    }),
    ({ serverGoalKey, threadId }, previous) => {
      const threadChanged = previousThreadId.value !== null && previousThreadId.value !== threadId;
      const serverGoalChanged =
        previousServerGoalKey.value !== null && previousServerGoalKey.value !== serverGoalKey;
      previousThreadId.value = threadId;
      previousServerGoalKey.value = serverGoalKey;
      if (threadChanged || serverGoalChanged || previous?.threadId !== threadId) {
        localGoal.value = undefined;
      }
      if (threadChanged) {
        goalErrorMessage.value = null;
      }
    },
    { immediate: true },
  );

  const activeGoal = computed(() => resolveActiveGoal(localGoal.value, toValue(serverGoal)));
  const hasGoal = computed(() => Boolean(activeGoal.value));

  async function refreshGoal() {
    return runGoalRequest(async () => {
      const goal = await getThreadGoal(toValue(threadId));
      localGoal.value = goal;
      return goal;
    });
  }

  async function saveGoal(objective: string, targetThreadId = toValue(threadId)) {
    const normalizedObjective = objective.trim();
    if (!normalizedObjective) {
      return null;
    }
    if (normalizedObjective.length > MAX_GOAL_OBJECTIVE_CHARS) {
      goalErrorMessage.value = `目标太长，请控制在 ${MAX_GOAL_OBJECTIVE_CHARS} 个字符以内。`;
      return null;
    }

    return runGoalRequest(async () => {
      const goal = await setThreadGoal(targetThreadId, { objective: normalizedObjective });
      localGoal.value = goal;
      return goal;
    });
  }

  async function clearGoal() {
    return runGoalRequest(async () => {
      const goal = await clearThreadGoal(toValue(threadId));
      localGoal.value = goal;
      return goal;
    });
  }

  async function runGoalRequest(request: () => Promise<GoalState | null>) {
    isGoalPending.value = true;
    goalErrorMessage.value = null;
    try {
      return await request();
    } catch (error) {
      goalErrorMessage.value =
        error instanceof Error ? error.message : "目标命令失败。";
      throw error;
    } finally {
      isGoalPending.value = false;
    }
  }

  return {
    activeGoal,
    clearGoal,
    goalErrorMessage,
    hasGoal,
    isGoalPending,
    refreshGoal,
    saveGoal,
  };
}

export function resolveActiveGoal(
  localGoal: GoalState | null | undefined,
  serverGoal: GoalState | null | undefined,
): GoalState | null {
  return localGoal !== undefined ? localGoal : (serverGoal ?? null);
}

export function getGoalContinuationDisplay(
  goal: Pick<GoalState, "continuation_count" | "max_continuations">,
): GoalContinuationDisplay | null {
  const count = goal.continuation_count ?? 0;
  const max = goal.max_continuations ?? 0;
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }
  return { count, max };
}

export function goalReconciliationKey(goal: GoalState | null): string {
  if (!goal) {
    return "none";
  }
  return [
    goal.objective,
    goal.status,
    goal.created_at ?? "",
    goal.updated_at ?? "",
    goal.continuation_count ?? 0,
  ].join("|");
}
