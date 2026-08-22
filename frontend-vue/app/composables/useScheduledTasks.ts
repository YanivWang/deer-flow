/*
  【文件职责】     Scheduled-task 列表、详情、runs 分页与 mutations 的唯一 Vue Query owner。
  【对应 frontend/】 core/scheduled-tasks/hooks.ts
  【架构位置】     L3 Vue server-state adapter
  【主要导出】     useScheduledTasks · useScheduledTaskDetail · useScheduledTaskRuns · useScheduledTaskMutations
  【依赖关系】     @tanstack/vue-query · scheduled-tasks api/query-keys/types
  【边界与注意】   queryFn 从自身 key 取 id，避免切 task 后 late response 交叉写入；轮询归 query observer。
*/
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

import {
  createScheduledTask,
  deleteScheduledTask,
  fetchScheduledTask,
  fetchScheduledTaskRuns,
  fetchScheduledTasks,
  fetchThreadScheduledTasks,
  pauseScheduledTask,
  resumeScheduledTask,
  triggerScheduledTask,
  updateScheduledTask,
  type ScheduledTaskCreatePayload,
  type ScheduledTaskUpdatePayload,
} from "@/core/scheduled-tasks/api";
import {
  scheduledTaskKeys,
  scheduledTaskMutationTargets,
  type ScheduledTaskMutation,
} from "@/core/scheduled-tasks/query-keys";
import type {
  ScheduledTask,
  ScheduledTaskRun,
} from "@/core/scheduled-tasks/types";

const ACTIVE_RUN_STATUSES = new Set<ScheduledTaskRun["status"]>([
  "queued",
  "running",
]);

export function useScheduledTasks(threadId: MaybeRefOrGetter<string | null>) {
  const queryKey = computed(() => {
    const current = toValue(threadId);
    return current
      ? scheduledTaskKeys.thread(current)
      : scheduledTaskKeys.list();
  });
  const query = useQuery({
    queryKey,
    queryFn: ({ queryKey: key, signal }) => {
      const keyType = String(key[1]);
      return keyType === "thread"
        ? fetchThreadScheduledTasks(String(key[2]), { signal })
        : fetchScheduledTasks({ signal });
    },
  });
  return {
    ...query,
    tasks: computed(() => query.data.value ?? []),
  };
}

export function useScheduledTaskDetail(
  taskId: MaybeRefOrGetter<string | null>,
) {
  const query = useQuery({
    queryKey: computed(() => scheduledTaskKeys.detail(toValue(taskId) ?? "")),
    enabled: computed(() => Boolean(toValue(taskId))),
    queryFn: ({ queryKey, signal }) =>
      fetchScheduledTask(String(queryKey[2]), { signal }),
  });
  return query;
}

export function useScheduledTaskRuns(
  taskId: MaybeRefOrGetter<string | null>,
  options: { pageSize?: number; pollIntervalMs?: number } = {},
) {
  const pageSize = options.pageSize ?? 50;
  const pollIntervalMs = options.pollIntervalMs ?? 2_000;
  const query = useInfiniteQuery<
    ScheduledTaskRun[],
    Error,
    InfiniteData<ScheduledTaskRun[], number>,
    readonly unknown[],
    number
  >({
    queryKey: computed(() => scheduledTaskKeys.runs(toValue(taskId) ?? "")),
    enabled: computed(() => Boolean(toValue(taskId))),
    initialPageParam: 0,
    queryFn: ({ queryKey, pageParam, signal }) =>
      fetchScheduledTaskRuns(String(queryKey[2]), {
        limit: pageSize,
        offset: pageParam,
        signal,
      }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === pageSize
        ? pages.reduce((count, page) => count + page.length, 0)
        : undefined,
    refetchInterval: (current) => {
      const pages = current.state.data?.pages ?? [];
      return pages.some((page) =>
        page.some((run) => ACTIVE_RUN_STATUSES.has(run.status)),
      )
        ? pollIntervalMs
        : false;
    },
  });

  let loadMorePromise: ReturnType<typeof query.fetchNextPage> | null = null;
  function loadMore() {
    if (
      loadMorePromise ||
      query.isFetchingNextPage.value ||
      !query.hasNextPage.value
    ) {
      return loadMorePromise ?? Promise.resolve();
    }
    loadMorePromise = query.fetchNextPage().finally(() => {
      loadMorePromise = null;
    });
    return loadMorePromise;
  }

  return {
    ...query,
    runs: computed(() =>
      (query.data.value?.pages ?? []).flatMap((page) => page),
    ),
    loadMore,
  };
}

type TaskMutationVariables = { task: ScheduledTask };
type UpdateMutationVariables = TaskMutationVariables & {
  payload: ScheduledTaskUpdatePayload;
};

export function useScheduledTaskMutations() {
  const queryClient = useQueryClient();

  async function sync(operation: ScheduledTaskMutation, task: ScheduledTask) {
    const targets = scheduledTaskMutationTargets(operation, task);
    const removeKeys = new Set(
      targets.remove.map((key) => JSON.stringify(key)),
    );
    await Promise.all(
      targets.invalidate
        .filter((key) => !removeKeys.has(JSON.stringify(key)))
        .map((queryKey) =>
          queryClient.invalidateQueries({ queryKey, exact: true }),
        ),
    );
    for (const queryKey of targets.remove) {
      queryClient.removeQueries({ queryKey, exact: true });
    }
  }

  const create = useMutation({
    mutationFn: (payload: ScheduledTaskCreatePayload) =>
      createScheduledTask(payload),
    onSuccess: async (task) => {
      queryClient.setQueryData(scheduledTaskKeys.detail(task.id), task);
      await sync("create", task);
    },
  });
  const update = useMutation({
    mutationFn: ({ task, payload }: UpdateMutationVariables) =>
      updateScheduledTask(task.id, payload),
    onSuccess: async (next, { task }) => {
      queryClient.setQueryData(scheduledTaskKeys.detail(next.id), next);
      await sync("update", task);
      await sync("update", next);
    },
  });
  const pause = useMutation({
    mutationFn: ({ task }: TaskMutationVariables) =>
      pauseScheduledTask(task.id),
    onSuccess: async (next) => {
      queryClient.setQueryData(scheduledTaskKeys.detail(next.id), next);
      await sync("pause", next);
    },
  });
  const resume = useMutation({
    mutationFn: ({ task }: TaskMutationVariables) =>
      resumeScheduledTask(task.id),
    onSuccess: async (next) => {
      queryClient.setQueryData(scheduledTaskKeys.detail(next.id), next);
      await sync("resume", next);
    },
  });
  const trigger = useMutation({
    mutationFn: ({ task }: TaskMutationVariables) =>
      triggerScheduledTask(task.id),
    onSuccess: async (_result, { task }) => sync("trigger", task),
  });
  const remove = useMutation({
    mutationFn: ({ task }: TaskMutationVariables) =>
      deleteScheduledTask(task.id),
    onSuccess: async (_result, { task }) => sync("delete", task),
  });

  return { create, update, pause, resume, trigger, remove };
}
