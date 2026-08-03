import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

import type { GoalState } from "../../../core/api/thread/types";
import {
  getGoalContinuationDisplay,
  useThreadGoal,
} from "../../../entities/thread/use-thread-goal";

export function useChatGoal(options: {
  refetchThreads: () => Promise<unknown>;
  serverGoal: MaybeRefOrGetter<GoalState | null | undefined>;
  threadId: MaybeRefOrGetter<string>;
}) {
  const goalDraft = ref("");
  const goalCommandObjective = ref("");
  const goalCommandThreadId = ref<string | null>(null);
  const threadGoal = useThreadGoal(options.threadId, options.serverGoal);

  const goalContinuation = computed(() =>
    threadGoal.activeGoal.value ? getGoalContinuationDisplay(threadGoal.activeGoal.value) : null,
  );
  const displayedGoalObjective = computed(() =>
    threadGoal.activeGoal.value?.objective
      ?? (goalCommandThreadId.value === toValue(options.threadId)
        ? goalCommandObjective.value
        : null),
  );

  watch(() => toValue(options.threadId), (nextThreadId, previousThreadId) => {
    if (previousThreadId && previousThreadId !== nextThreadId && goalCommandThreadId.value !== nextThreadId) {
      resetCommand();
    }
  });

  function onGoalCommand(objective: string, targetThreadId: string): void {
    goalCommandObjective.value = objective;
    goalCommandThreadId.value = targetThreadId;
  }

  function resetCommand(): void {
    goalCommandObjective.value = "";
    goalCommandThreadId.value = null;
  }

  async function submitGoal(): Promise<void> {
    const objective = goalDraft.value.trim();
    if (!objective) {
      goalDraft.value = "";
      return;
    }
    await threadGoal.saveGoal(objective);
    goalDraft.value = "";
    await options.refetchThreads();
  }

  async function clearGoal(): Promise<void> {
    await threadGoal.clearGoal();
    goalDraft.value = "";
    await options.refetchThreads();
  }

  async function refreshGoal(): Promise<void> {
    await threadGoal.refreshGoal();
  }

  return {
    activeGoal: threadGoal.activeGoal,
    clearGoal,
    displayedGoalObjective,
    goalContinuation,
    goalDraft,
    goalErrorMessage: threadGoal.goalErrorMessage,
    hasGoal: threadGoal.hasGoal,
    isGoalPending: threadGoal.isGoalPending,
    onGoalCommand,
    refreshGoal,
    resetCommand,
    saveGoal: threadGoal.saveGoal,
    submitGoal,
  };
}

export type ChatGoalController = ReturnType<typeof useChatGoal>;
