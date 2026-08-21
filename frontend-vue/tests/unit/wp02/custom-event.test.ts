import { describe, expect, it } from "vitest";

import {
  clearThreadRetryNotice,
  createThreadCustomEventState,
  reduceThreadCustomEvent,
} from "@/core/tasks/custom-event";

describe("thread custom-event reducer", () => {
  it("folds out-of-order and replayed task events into one ordered terminal task", () => {
    let state = createThreadCustomEventState();
    state = reduceThreadCustomEvent(state, {
      type: "task_started",
      task_id: "task-1",
      description: "Research the market",
      model_name: "claude-sonnet",
    }).state;
    state = reduceThreadCustomEvent(state, {
      type: "task_running",
      task_id: "task-1",
      message_index: 2,
      message: { type: "tool", name: "web_search", content: "results" },
      usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
    }).state;
    state = reduceThreadCustomEvent(state, {
      type: "task_running",
      task_id: "task-1",
      message_index: 1,
      message: { type: "ai", content: "I will search first." },
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    }).state;
    state = reduceThreadCustomEvent(state, {
      type: "task_running",
      task_id: "task-1",
      message_index: 2,
      message: { type: "tool", name: "web_search", content: "results" },
      usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
    }).state;
    state = reduceThreadCustomEvent(state, {
      type: "task_completed",
      task_id: "task-1",
      result: "Done",
      model_name: "claude-sonnet",
      usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
    }).state;
    // A late replayed progress frame may fill a missing step, but it cannot
    // roll a terminal task back to in_progress or double-count usage.
    state = reduceThreadCustomEvent(state, {
      type: "task_running",
      task_id: "task-1",
      message_index: 3,
      message: { type: "ai", content: "Done" },
      usage: { input_tokens: 15, output_tokens: 5, total_tokens: 20 },
    }).state;

    expect(state.tasks["task-1"]).toMatchObject({
      status: "completed",
      description: "Research the market",
      modelName: "claude-sonnet",
      result: "Done",
      usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
    });
    expect(
      state.tasks["task-1"]?.steps?.map((step) => step.message_index),
    ).toEqual([1, 2, 3]);
  });

  it.each(["task_failed", "task_cancelled", "task_timed_out"])(
    "maps %s to a visible failed terminal state",
    (type) => {
      const state = reduceThreadCustomEvent(createThreadCustomEventState(), {
        type,
        task_id: "task-1",
        error: "Provider stopped",
      }).state;
      expect(state.tasks["task-1"]).toMatchObject({
        status: "failed",
        error: "Provider stopped",
      });
    },
  );

  it("normalizes llm_retry and clears it on progress or terminal cleanup", () => {
    const retried = reduceThreadCustomEvent(createThreadCustomEventState(), {
      type: "llm_retry",
      attempt: 1,
      max_attempts: 2,
      wait_ms: 750,
      reason: "rate_limit",
      message: "The model is busy. Retrying…",
    }).state;
    expect(retried.retry).toEqual({
      attempt: 1,
      maxAttempts: 2,
      waitMs: 750,
      reason: "rate_limit",
      message: "The model is busy. Retrying…",
    });
    expect(clearThreadRetryNotice(retried).retry).toBeNull();
    expect(
      reduceThreadCustomEvent(retried, {
        type: "task_running",
        task_id: "task-1",
        message_index: 1,
        message: { type: "ai", content: "Continuing" },
      }).state.retry,
    ).toBeNull();
  });

  it("turns replay gaps into one reducer effect and clears transient tasks/retry", () => {
    let state = reduceThreadCustomEvent(createThreadCustomEventState(), {
      type: "task_started",
      task_id: "task-1",
      description: "Work",
    }).state;
    state = reduceThreadCustomEvent(state, {
      type: "llm_retry",
      attempt: 1,
      max_attempts: 2,
      wait_ms: 100,
      reason: "busy",
      message: "Retrying",
    }).state;

    const reduced = reduceThreadCustomEvent(state, {
      type: "stream_replay_gap",
      run_id: "run-1",
    });
    expect(reduced.effect).toBe("replay_gap");
    expect(reduced.state.tasks).toEqual({});
    expect(reduced.state.retry).toBeNull();
  });
});
