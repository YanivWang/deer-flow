import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

import {
  createScheduledTask,
  deleteScheduledTask,
  fetchScheduledTaskRuns,
  fetchScheduledTasks,
  pauseScheduledTask,
  resumeScheduledTask,
  triggerScheduledTask,
  type ScheduledTaskPayload,
  type ScheduledTaskUpdatePayload,
  updateScheduledTask,
} from "../../core/api/scheduled-tasks/client";
export const SCHEDULED_TASKS_QUERY_KEY = ["scheduled-tasks"] as const;

export function useScheduledTasks(threadId: MaybeRefOrGetter<string | null | undefined> = null) {
  const queryClient = useQueryClient();
  const selectedTaskId = ref<string | null>(null);
  const resolvedThreadId = computed(() => toValue(threadId) || null);
  const query = useQuery({
    queryKey: computed(() => [...SCHEDULED_TASKS_QUERY_KEY, resolvedThreadId.value]),
    queryFn: () => fetchScheduledTasks({ threadId: resolvedThreadId.value }),
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });
  const tasks = computed(() => query.data.value ?? []);

  watch(tasks, (nextTasks) => {
    if (nextTasks.length === 0) {
      selectedTaskId.value = null;
      return;
    }
    if (!selectedTaskId.value || !nextTasks.some((task) => task.id === selectedTaskId.value)) {
      selectedTaskId.value = nextTasks[0]?.id ?? null;
    }
  }, { immediate: true });

  const selectedTask = computed(
    () => tasks.value.find((task) => task.id === selectedTaskId.value) ?? null,
  );
  const runsQuery = useQuery({
    enabled: computed(() => Boolean(selectedTaskId.value)),
    queryKey: computed(() => [...SCHEDULED_TASKS_QUERY_KEY, "runs", selectedTaskId.value]),
    queryFn: () => fetchScheduledTaskRuns(selectedTaskId.value ?? ""),
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: (payload: ScheduledTaskPayload) => createScheduledTask(payload),
    onSuccess(task) {
      selectedTaskId.value = task.id;
      invalidateScheduledTasks(queryClient);
    },
  });
  const updateMutation = useMutation({
    mutationFn: (input: { payload: ScheduledTaskUpdatePayload; taskId: string }) =>
      updateScheduledTask(input.taskId, input.payload),
    onSuccess(task) {
      selectedTaskId.value = task.id;
      invalidateScheduledTasks(queryClient);
    },
  });
  const pauseMutation = useMutation({
    mutationFn: (taskId: string) => pauseScheduledTask(taskId),
    onSuccess: () => invalidateScheduledTasks(queryClient),
  });
  const resumeMutation = useMutation({
    mutationFn: (taskId: string) => resumeScheduledTask(taskId),
    onSuccess: () => invalidateScheduledTasks(queryClient),
  });
  const triggerMutation = useMutation({
    mutationFn: (taskId: string) => triggerScheduledTask(taskId),
    onSuccess(_result, taskId) {
      invalidateScheduledTasks(queryClient);
      void queryClient.invalidateQueries({
        queryKey: [...SCHEDULED_TASKS_QUERY_KEY, "runs", taskId],
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteScheduledTask(taskId),
    onSuccess(_result, taskId) {
      if (selectedTaskId.value === taskId) {
        selectedTaskId.value = null;
      }
      invalidateScheduledTasks(queryClient);
    },
  });

  const actionErrorMessage = computed(
    () =>
      messageOfMutationError(createMutation.error.value) ??
      messageOfMutationError(updateMutation.error.value) ??
      messageOfMutationError(pauseMutation.error.value) ??
      messageOfMutationError(resumeMutation.error.value) ??
      messageOfMutationError(triggerMutation.error.value) ??
      messageOfMutationError(deleteMutation.error.value),
  );

  return {
    actionErrorMessage,
    createTask: createMutation.mutateAsync,
    deleteTask: deleteMutation.mutateAsync,
    isActionPending: computed(
      () =>
        createMutation.isPending.value ||
        updateMutation.isPending.value ||
        pauseMutation.isPending.value ||
        resumeMutation.isPending.value ||
        triggerMutation.isPending.value ||
        deleteMutation.isPending.value,
    ),
    pauseTask: pauseMutation.mutateAsync,
    query,
    resumeTask: resumeMutation.mutateAsync,
    runs: computed(() => runsQuery.data.value ?? []),
    runsQuery,
    selectedTask,
    selectedTaskId,
    tasks,
    triggerTask: triggerMutation.mutateAsync,
    updateTask: updateMutation.mutateAsync,
  };
}

function invalidateScheduledTasks(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: SCHEDULED_TASKS_QUERY_KEY });
}

function messageOfMutationError(error: Error | null): string | null {
  return error?.message ?? null;
}
