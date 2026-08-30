/*
  【文件职责】     验证Vue Query 在 task 切换与 scope dispose 后拒绝 stale 回写并停止轮询。
  【架构位置】     Vue DOM/composable test
  【主要导出】     无；Vitest cases
  【依赖关系】     @tanstack/vue-query · composables/useScheduledTasks
  【边界与注意】   不使用组件级 timer；poll 归 query observer，unmount 后必须停止。
                   轮询是**固定 15 秒、与运行状态无关**的，与 React 的
                   `refetchInterval: 15000` 同一个值——此前只在有 queued/running 的运行时
                   才以 2 秒轮询，那是 Vue 独有的一套节奏。
*/
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScheduledTaskRuns } from "@/composables/useScheduledTasks";
import type { ScheduledTaskRun } from "@/core/scheduled-tasks/types";

const api = vi.hoisted(() => ({
  fetchScheduledTaskRuns: vi.fn(),
}));

vi.mock("@/core/scheduled-tasks/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchScheduledTaskRuns: api.fetchScheduledTaskRuns,
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useScheduledTaskRuns", () => {
  it("does not write task A's late runs into task B", async () => {
    const first = deferred<unknown[]>();
    const second = deferred<unknown[]>();
    api.fetchScheduledTaskRuns.mockImplementation((taskId: string) =>
      taskId === "task-a" ? first.promise : second.promise,
    );
    const taskId = ref<string | null>("task-a");
    let state!: ReturnType<typeof useScheduledTaskRuns>;
    const Host = defineComponent({
      setup() {
        state = useScheduledTaskRuns(taskId);
        return () => h("div", state.runs.value.map((run) => run.id).join(","));
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = mount(Host, {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    });

    taskId.value = "task-b";
    await nextTick();
    second.resolve([{ id: "run-b", status: "success", task_id: "task-b" }]);
    await vi.waitFor(() => expect(wrapper.text()).toBe("run-b"));
    first.resolve([{ id: "run-a", status: "success", task_id: "task-a" }]);
    await Promise.resolve();
    await nextTick();

    expect(wrapper.text()).toBe("run-b");
    wrapper.unmount();
    queryClient.clear();
  });

  it("keeps one in-flight loadMore instead of queueing a second page", async () => {
    const pages: Record<number, ScheduledTaskRun[]> = {
      0: Array.from({ length: 50 }, (_, index) => ({
        id: `run-${index}`,
      })) as ScheduledTaskRun[],
      50: [{ id: "run-50" }] as ScheduledTaskRun[],
    };
    const offsets: number[] = [];
    api.fetchScheduledTaskRuns.mockImplementation(
      (_taskId: string, options: { offset?: number }) => {
        offsets.push(options.offset ?? 0);
        return Promise.resolve(pages[options.offset ?? 0] ?? []);
      },
    );
    let state!: ReturnType<typeof useScheduledTaskRuns>;
    const Host = defineComponent({
      setup() {
        state = useScheduledTaskRuns(ref("task-a"));
        return () => h("div", String(state.runs.value.length));
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = mount(Host, {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    });
    await vi.waitFor(() => expect(wrapper.text()).toBe("50"));

    await Promise.all([state.loadMore(), state.loadMore()]);
    await vi.waitFor(() => expect(wrapper.text()).toBe("51"));
    expect(offsets).toEqual([0, 50]);

    wrapper.unmount();
    queryClient.clear();
  });

  it("polls every 15s even with no active run, and stops after unmount", async () => {
    vi.useFakeTimers();
    // 全部已结束：旧实现在这种数据上根本不轮询。
    api.fetchScheduledTaskRuns.mockResolvedValue([
      { id: "run-done", task_id: "task-a", status: "success" },
    ]);
    const Host = defineComponent({
      setup() {
        useScheduledTaskRuns(ref("task-a"));
        return () => h("div");
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = mount(Host, {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    });
    await vi.waitFor(() =>
      expect(api.fetchScheduledTaskRuns).toHaveBeenCalledTimes(1),
    );
    await vi.advanceTimersByTimeAsync(15_000);
    expect(api.fetchScheduledTaskRuns).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.fetchScheduledTaskRuns).toHaveBeenCalledTimes(2);
    queryClient.clear();
  });
});
