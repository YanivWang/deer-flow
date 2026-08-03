import { flushPromises, mount } from "@vue/test-utils";
import { computed, defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useChatGoal } from "../../../../app/features/chat/goal/use-chat-goal";

describe("useChatGoal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("trims and persists goals, then clears them with thread-cache refetches", async () => {
    const goal = createGoal("New goal");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ goal }))
      .mockResolvedValueOnce(Response.json({ goal: null }));
    vi.stubGlobal("fetch", fetchMock);
    const refetchThreads = vi.fn(async () => undefined);

    const Host = defineComponent({
      setup() {
        const controller = useChatGoal({
          refetchThreads,
          serverGoal: ref(null),
          threadId: ref("thread-a"),
        });
        return () => h("div", [
          h("input", { "data-testid": "draft", value: controller.goalDraft.value, onInput: (event: Event) => {
            controller.goalDraft.value = (event.target as HTMLInputElement).value;
          } }),
          h("button", { "data-testid": "submit", onClick: controller.submitGoal }, "submit"),
          h("button", { "data-testid": "clear", onClick: controller.clearGoal }, "clear"),
          h("p", { "data-testid": "objective" }, controller.displayedGoalObjective.value ?? ""),
        ]);
      },
    });

    const wrapper = mount(Host);
    await wrapper.get('[data-testid="draft"]').setValue(" New goal ");
    await wrapper.get('[data-testid="submit"]').trigger("click");
    await flushPromises();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/threads/thread-a/goal");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ method: "PUT" }));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ objective: "New goal" });
    expect(refetchThreads).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-testid="objective"]').text()).toBe("New goal");

    await wrapper.get('[data-testid="clear"]').trigger("click");
    await flushPromises();

    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: "DELETE" }));
    expect(refetchThreads).toHaveBeenCalledTimes(2);
    expect(wrapper.get('[data-testid="objective"]').text()).toBe("");
  });

  it("keeps slash-goal command text scoped to its target thread", async () => {
    const threadId = ref("thread-a");
    const Host = defineComponent({
      setup() {
        const controller = useChatGoal({
          refetchThreads: vi.fn(async () => undefined),
          serverGoal: computed(() => null),
          threadId,
        });
        controller.resetCommand();
        return () => h("div", [
          h("button", { "data-testid": "command", onClick: () => controller.onGoalCommand("Finish migration", "thread-a") }, "command"),
          h("button", { "data-testid": "switch", onClick: () => { threadId.value = "thread-b"; } }, "switch"),
          h("p", { "data-testid": "objective" }, controller.displayedGoalObjective.value ?? ""),
        ]);
      },
    });

    const wrapper = mount(Host);
    await wrapper.get('[data-testid="command"]').trigger("click");
    expect(wrapper.get('[data-testid="objective"]').text()).toBe("Finish migration");
    await wrapper.get('[data-testid="switch"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="objective"]').text()).toBe("");
  });
});

function createGoal(objective: string) {
  return {
    continuation_count: 0,
    created_at: "2026-08-03T00:00:00Z",
    max_continuations: 8,
    max_no_progress_continuations: 3,
    no_progress_count: 0,
    objective,
    status: "active" as const,
    updated_at: "2026-08-03T00:00:00Z",
  };
}
