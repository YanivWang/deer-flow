/*
  【文件职责】     验证 WP-07 Vue Query 在 task 切换与 scope dispose 后拒绝 stale 回写并停止轮询。
  【对应 frontend/】 core/scheduled-tasks/hooks.ts
  【架构位置】     WP-07 Vue DOM/composable test
  【主要导出】     无；Vitest cases
  【依赖关系】     @tanstack/vue-query · composables/useScheduledTasks
  【边界与注意】   不使用组件级 timer；poll 归 query observer，unmount 后必须停止。
*/
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScheduledTaskRuns } from "@/composables/useScheduledTasks";

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

  it("polls only while an active run is visible and stops after unmount", async () => {
    vi.useFakeTimers();
    api.fetchScheduledTaskRuns.mockResolvedValue([
      { id: "run-active", task_id: "task-a", status: "running" },
    ]);
    const Host = defineComponent({
      setup() {
        useScheduledTaskRuns(ref("task-a"), { pollIntervalMs: 1000 });
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
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.fetchScheduledTaskRuns).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.fetchScheduledTaskRuns).toHaveBeenCalledTimes(2);
    queryClient.clear();
  });
});
