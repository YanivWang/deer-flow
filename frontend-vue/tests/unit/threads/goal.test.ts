import { describe, expect, it } from "vitest";

import {
  getGoalObjectiveCounter,
  GOAL_OBJECTIVE_COUNTER_VISIBLE_AT,
  goalContinuation,
  MAX_GOAL_OBJECTIVE_CHARS,
  parseGoalCommand,
} from "@/core/threads/goal";

describe("goal commands", () => {
  it("distinguishes status, clear aliases, and set", () => {
    expect(parseGoalCommand("/goal")).toEqual({ kind: "status" });
    expect(parseGoalCommand("/goal reset")).toEqual({ kind: "clear" });
    expect(parseGoalCommand("/goal ship M6")).toEqual({
      kind: "set",
      objective: "ship M6",
    });
    expect(parseGoalCommand("hello")).toBeNull();
  });

  /*
    计数器只对 `/goal <objective>` 计数，而且量的是**解析后的 objective**：
    发出去的、被 goalTooLong 判定的都是这一串，量原文会让用户在 3999/4000 时
    被后端拒掉。阈值是上限的 90%（上游 input-box-helpers.ts）。
  */
  it("counts the parsed objective and only within reach of the limit", () => {
    expect(GOAL_OBJECTIVE_COUNTER_VISIBLE_AT).toBe(3600);
    expect(getGoalObjectiveCounter("just text")).toBeNull();
    expect(getGoalObjectiveCounter("/goal")).toBeNull();
    expect(getGoalObjectiveCounter("/goal clear")).toBeNull();
    expect(getGoalObjectiveCounter(`/goal ${"a".repeat(3599)}`)).toBeNull();

    expect(getGoalObjectiveCounter(`/goal ${"a".repeat(3600)}`)).toEqual({
      length: 3600,
      max: MAX_GOAL_OBJECTIVE_CHARS,
      overLimit: false,
    });
    // 前后空白在解析时就被吃掉了，所以计数器跟着 objective 走而不是跟着原文。
    expect(
      getGoalObjectiveCounter(`/goal   ${"a".repeat(3600)}   `),
    ).toMatchObject({ length: 3600 });
    expect(getGoalObjectiveCounter(`/goal ${"a".repeat(4000)}`)).toMatchObject({
      overLimit: false,
    });
    expect(getGoalObjectiveCounter(`/goal ${"a".repeat(4001)}`)).toMatchObject({
      length: 4001,
      overLimit: true,
    });
  });

  it("only exposes a continuation counter after continuation starts", () => {
    expect(
      goalContinuation({ continuation_count: 0, max_continuations: 8 }),
    ).toBeNull();
    expect(
      goalContinuation({ continuation_count: 2, max_continuations: 8 }),
    ).toEqual({ count: 2, max: 8 });
  });
});
