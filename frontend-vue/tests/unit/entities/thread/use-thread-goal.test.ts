import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getGoalContinuationDisplay,
  MAX_GOAL_OBJECTIVE_CHARS,
  resolveActiveGoal,
  useThreadGoal,
} from "../../../../app/entities/thread/use-thread-goal";
import type { GoalState } from "../../../../app/core/api/thread/types";

describe("useThreadGoal", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers the local goal override until server goal is explicitly updated", async () => {
    const serverGoal = ref<GoalState | null | undefined>(goal("Server goal"));
    const wrapper = mountGoalHarness(ref("thread-a"), serverGoal);

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ goal: goal("Local goal") })));
    await wrapper.vm.threadGoal.saveGoal(" Local goal ");
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.threadGoal.activeGoal.value?.objective).toBe("Local goal");

    serverGoal.value = goal("Server updated");
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.threadGoal.activeGoal.value?.objective).toBe("Server updated");
  });

  it("clears local errors and overrides when the thread changes", async () => {
    const threadId = ref("thread-a");
    const wrapper = mountGoalHarness(threadId, ref<GoalState | null | undefined>(undefined));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ detail: "Thread has a run in flight." }, { status: 409 })),
    );

    await expect(wrapper.vm.threadGoal.clearGoal()).rejects.toThrow("Thread has a run in flight.");
    expect(wrapper.vm.threadGoal.goalErrorMessage.value).toBe("Thread has a run in flight.");

    threadId.value = "thread-b";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.threadGoal.goalErrorMessage.value).toBeNull();
    expect(wrapper.vm.threadGoal.activeGoal.value).toBeNull();
  });

  it("rejects over-length objectives before issuing a request", async () => {
    const fetchMock = vi.fn(async () => Response.json({ goal: goal("never") }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountGoalHarness(ref("thread-a"), ref<GoalState | null | undefined>(null));

    const result = await wrapper.vm.threadGoal.saveGoal("x".repeat(MAX_GOAL_OBJECTIVE_CHARS + 1));

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.vm.threadGoal.goalErrorMessage.value).toContain("目标太长");
  });

  it("can save against a created thread before the route ref updates", async () => {
    const fetchMock = vi.fn(async () => Response.json({ goal: goal("Created thread goal") }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountGoalHarness(ref("new"), ref<GoalState | null | undefined>(undefined));

    await wrapper.vm.threadGoal.saveGoal("Created thread goal", "thread-created");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/threads/thread-created/goal",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("reads continuation display only after hidden continuation starts", () => {
    expect(getGoalContinuationDisplay(goal("Fresh"))).toBeNull();
    expect(
      getGoalContinuationDisplay({
        ...goal("Continuing"),
        continuation_count: 2,
        max_continuations: 8,
      }),
    ).toEqual({ count: 2, max: 8 });
  });

  it("resolves local goal overrides before server state", () => {
    expect(resolveActiveGoal(null, goal("Server"))).toBeNull();
    expect(resolveActiveGoal(undefined, goal("Server"))?.objective).toBe("Server");
    expect(resolveActiveGoal(goal("Local"), goal("Server"))?.objective).toBe("Local");
  });
});

function mountGoalHarness(
  threadId: ReturnType<typeof ref<string>>,
  serverGoal: ReturnType<typeof ref<GoalState | null | undefined>>,
) {
  return mount(
    defineComponent({
      setup() {
        const threadGoal = useThreadGoal(
          computed(() => threadId.value),
          computed(() => serverGoal.value),
        );
        return { threadGoal };
      },
      render() {
        return h("div");
      },
    }),
  );
}

function goal(objective: string): GoalState {
  return {
    objective,
    status: "active",
    created_at: "2026-07-31T00:00:00Z",
    updated_at: "2026-07-31T00:00:00Z",
    continuation_count: 0,
    max_continuations: 8,
    no_progress_count: 0,
    max_no_progress_continuations: 2,
  };
}
