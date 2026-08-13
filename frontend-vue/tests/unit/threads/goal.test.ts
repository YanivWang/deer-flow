import { describe, expect, it } from "vitest";

import { goalContinuation, parseGoalCommand } from "@/core/threads/goal";

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

  it("only exposes a continuation counter after continuation starts", () => {
    expect(
      goalContinuation({ continuation_count: 0, max_continuations: 8 }),
    ).toBeNull();
    expect(
      goalContinuation({ continuation_count: 2, max_continuations: 8 }),
    ).toEqual({ count: 2, max: 8 });
  });
});
