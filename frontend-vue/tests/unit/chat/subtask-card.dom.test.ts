import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import SubtaskCard from "@/components/chat/SubtaskCard.vue";
import type { Subtask } from "@/core/tasks/types";

const fetchedSteps = [
  { message_index: 1, kind: "ai" as const, text: "Planning the search" },
  {
    message_index: 2,
    kind: "tool" as const,
    text: "found sources",
    tool_name: "web_search",
  },
];
const { fetchSubtaskSteps } = vi.hoisted(() => ({
  fetchSubtaskSteps: vi.fn(),
}));
vi.mock("@/core/tasks/api", () => ({ fetchSubtaskSteps }));

describe("SubtaskCard", () => {
  it("renders normalized terminal metadata and backfills history on expand", async () => {
    fetchSubtaskSteps.mockResolvedValue(fetchedSteps);
    const liveTask: Subtask = {
      id: "task-1",
      status: "completed",
      subagent_type: "research",
      description: "Research competitors",
      prompt: "Compare the market",
      modelName: "claude-sonnet",
      usage: { inputTokens: 800, outputTokens: 400, totalTokens: 1200 },
      result: "Three competitors found.",
    };
    const wrapper = mount(SubtaskCard, {
      attachTo: document.body,
      props: {
        taskId: "task-1",
        threadId: "thread-1",
        runId: "run-1",
        description: "Research competitors",
        prompt: "Compare the market",
        liveTask,
        terminal: {
          status: "completed",
          result: "Three competitors found.",
          modelName: "claude-sonnet",
          usage: { inputTokens: 800, outputTokens: 400, totalTokens: 1200 },
        },
        pendingStatus: "completed",
        isLoading: false,
      },
    });

    expect(wrapper.text()).toContain("Research competitors");
    expect(wrapper.text()).toContain("claude-sonnet");
    expect(wrapper.text()).toContain("1,200");
    expect(wrapper.text()).toContain("Completed");

    const toggle = wrapper.get('[data-testid="subtask-toggle"]');
    await toggle.trigger("click");
    await flushPromises();
    expect(fetchSubtaskSteps).toHaveBeenCalledWith(
      "thread-1",
      "run-1",
      "task-1",
    );
    expect(wrapper.text()).toContain("Planning the search");
    expect(wrapper.text()).toContain("web_search");
    expect(wrapper.text()).toContain("Three competitors found.");
    expect(toggle.attributes("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(toggle.element);
    wrapper.unmount();
  });

  it("shows a retry action when historical step loading fails", async () => {
    fetchSubtaskSteps.mockRejectedValueOnce(new Error("events unavailable"));
    const wrapper = mount(SubtaskCard, {
      props: {
        taskId: "task-2",
        threadId: "thread-1",
        runId: "run-2",
        description: "Research",
        prompt: "Research",
        pendingStatus: "failed",
        isLoading: false,
      },
    });
    await wrapper.get('[data-testid="subtask-toggle"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="subtask-steps-retry"]').text()).toContain(
      "Try again",
    );
  });
});
