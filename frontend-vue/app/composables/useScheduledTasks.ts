/*
  【文件职责】     Scheduled-task 列表、runs 与 mutations 的唯一 Vue Query owner。
  【架构位置】     L3 Vue server-state adapter
  【主要导出】     useScheduledTasks · useScheduledTaskRuns · useScheduledTaskMutations
  【依赖关系】     @tanstack/vue-query · scheduled-tasks api/query-keys/types
  【边界与注意】   queryFn 从自身 key 取 id，避免切 task 后 late response 交叉写入。

                   **没有** detail query。选中的任务从列表那一份数据里取，与 React 的
                   `filteredData.find(...) ?? filteredData[0]` 同一条路径。此前 Vue 在选中
                   时额外 `GET /api/scheduled-tasks/{id}`，多出来的那次请求既没有新信息
                   （list 与 detail 返回同一个对象），失败时又**无人呈现**——页面只把
                   list 的 error 接到了提示上，detail 的 404 被静默吞掉。对照取样实测：
                   Vue 侧那条请求返回 404，页面同时显示着任务详情和一条
                   「Scheduled task not found」。

                   这多出来的一次取数，实际上是在补 Vue 少做的另一件事：React 的列表与
                   runs 都是 `refetchInterval: 15000`（后台标签页不轮询），所以调度器把
                   next_run_at 推进、把状态改成 running 时页面会自己跟上；Vue 原来两条
                   都不轮询，只在 selection 变化时抓一次详情。轮询补上之后，详情请求就是
                   纯粹的多余。

                   runs 分页。Gateway 的 `GET …/runs` 默认只返回 50 条，把这一页的长度
                   当成运行总数，就会在一个跑过几百次的任务上显示「50 runs」并且没有任何
                   办法看到其余的——页面在说历史已经完整，而它不是。React 原来就是这么
                   做的，同一份分页已经同步到 frontend/src/core/scheduled-tasks/hooks.ts，
                   两边同一个页大小、同一个 getNextPageParam。
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
import { scheduledTaskKeys } from "@/core/scheduled-tasks/query-keys";
import type {
  ScheduledTask,
  ScheduledTaskRun,
} from "@/core/scheduled-tasks/types";

/** 与 React 的 `refetchInterval: 15000` 同一个值。 */
const POLL_INTERVAL_MS = 15_000;

/** Gateway 自己对 `GET …/runs` 的默认页大小，与 React 的同名常量一致。 */
const RUNS_PAGE_SIZE = 50;

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
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
  return {
    ...query,
    tasks: computed(() => query.data.value ?? []),
  };
}

export function useScheduledTaskRuns(taskId: MaybeRefOrGetter<string | null>) {
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
        limit: RUNS_PAGE_SIZE,
        offset: pageParam,
        signal,
      }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === RUNS_PAGE_SIZE
        ? pages.reduce((count, page) => count + page.length, 0)
        : undefined,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  // 连点两下「加载更多」只发一次请求：fetchNextPage 在飞行中时不再排队。
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

  /** 前缀失效，不是精确 key：见 query-keys.ts 文件头。 */
  const sync = () =>
    queryClient.invalidateQueries({ queryKey: scheduledTaskKeys.root() });

  const create = useMutation({
    mutationFn: (payload: ScheduledTaskCreatePayload) =>
      createScheduledTask(payload),
    onSuccess: sync,
  });
  const update = useMutation({
    mutationFn: ({ task, payload }: UpdateMutationVariables) =>
      updateScheduledTask(task.id, payload),
    onSuccess: sync,
  });
  const pause = useMutation({
    mutationFn: ({ task }: TaskMutationVariables) =>
      pauseScheduledTask(task.id),
    onSuccess: sync,
  });
  const resume = useMutation({
    mutationFn: ({ task }: TaskMutationVariables) =>
      resumeScheduledTask(task.id),
    onSuccess: sync,
  });
  const trigger = useMutation({
    mutationFn: ({ task }: TaskMutationVariables) =>
      triggerScheduledTask(task.id),
    onSuccess: sync,
  });
  const remove = useMutation({
    mutationFn: ({ task }: TaskMutationVariables) =>
      deleteScheduledTask(task.id),
    onSuccess: sync,
  });

  return { create, update, pause, resume, trigger, remove };
}
