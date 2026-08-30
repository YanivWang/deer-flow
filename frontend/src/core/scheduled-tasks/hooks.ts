import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { useI18n } from "@/core/i18n/hooks";

import {
  createScheduledTask,
  deleteScheduledTask,
  fetchScheduledTaskRuns,
  fetchScheduledTasks,
  fetchThreadScheduledTasks,
  pauseScheduledTask,
  resumeScheduledTask,
  triggerScheduledTask,
  updateScheduledTask,
  type ScheduledTaskPayload,
} from "./api";

export function useScheduledTasks() {
  return useQuery({
    queryKey: ["scheduled-tasks"],
    queryFn: fetchScheduledTasks,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
}

export function useThreadScheduledTasks(threadId: string | null | undefined) {
  return useQuery({
    queryKey: ["scheduled-tasks", "thread", threadId],
    queryFn: () => fetchThreadScheduledTasks(threadId ?? ""),
    enabled: Boolean(threadId),
  });
}

/** The Gateway's own default page size for `GET /scheduled-tasks/{id}/runs`. */
export const SCHEDULED_TASK_RUNS_PAGE_SIZE = 50;

// Runs are paginated. Asking for one page and rendering its length as the run
// count reports "50 runs" for a task that has hundreds, with no way to reach
// the rest — the page said the history was complete when it was not.
export function useScheduledTaskRuns(taskId: string | null | undefined) {
  return useInfiniteQuery({
    queryKey: ["scheduled-tasks", "runs", taskId],
    queryFn: ({ pageParam }) =>
      fetchScheduledTaskRuns(taskId ?? "", {
        limit: SCHEDULED_TASK_RUNS_PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === SCHEDULED_TASK_RUNS_PAGE_SIZE
        ? pages.reduce((count, page) => count + page.length, 0)
        : undefined,
    enabled: Boolean(taskId),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
}

export function useCreateScheduledTask() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: (payload: ScheduledTaskPayload) => createScheduledTask(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
    },
    onError: (error: Error) => {
      toast.error(`${t.scheduledTasks.errors.create}: ${error.message}`);
    },
  });
}

export function useUpdateScheduledTask(taskId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: (
      payload: Partial<
        Omit<ScheduledTaskPayload, "thread_id" | "schedule_type">
      >,
    ) => updateScheduledTask(taskId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
      void queryClient.invalidateQueries({
        queryKey: ["scheduled-tasks", "thread"],
      });
    },
    onError: (error: Error) => {
      toast.error(`${t.scheduledTasks.errors.update}: ${error.message}`);
    },
  });
}

export function usePauseScheduledTask() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: (taskId: string) => pauseScheduledTask(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
      void queryClient.invalidateQueries({
        queryKey: ["scheduled-tasks", "thread"],
      });
    },
    onError: (error: Error) => {
      toast.error(`${t.scheduledTasks.errors.pause}: ${error.message}`);
    },
  });
}

export function useResumeScheduledTask() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: (taskId: string) => resumeScheduledTask(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
      void queryClient.invalidateQueries({
        queryKey: ["scheduled-tasks", "thread"],
      });
    },
    onError: (error: Error) => {
      toast.error(`${t.scheduledTasks.errors.resume}: ${error.message}`);
    },
  });
}

export function useTriggerScheduledTask() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: (taskId: string) => triggerScheduledTask(taskId),
    onSuccess: (_result, taskId) => {
      void queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
      void queryClient.invalidateQueries({
        queryKey: ["scheduled-tasks", "thread"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["scheduled-tasks", "runs", taskId],
      });
    },
    onError: (error: Error) => {
      toast.error(`${t.scheduledTasks.errors.trigger}: ${error.message}`);
    },
  });
}

export function useDeleteScheduledTask() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: (taskId: string) => deleteScheduledTask(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
      void queryClient.invalidateQueries({
        queryKey: ["scheduled-tasks", "thread"],
      });
    },
    onError: (error: Error) => {
      toast.error(`${t.scheduledTasks.errors.delete}: ${error.message}`);
    },
  });
}
