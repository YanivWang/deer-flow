import { describe, expect, it } from "vitest";

import { mergeThreadSnapshot } from "@/core/threads/thread-snapshot";
import type { AgentThread } from "@/core/threads/types";

function thread(values: AgentThread["values"]): AgentThread {
  return {
    thread_id: "thread-1",
    created_at: "2026-08-13T00:00:00Z",
    updated_at: "2026-08-13T00:00:00Z",
    metadata: {},
    status: "idle",
    values,
    interrupts: {},
  };
}

describe("mergeThreadSnapshot", () => {
  it("retains detailed state when a later list summary only updates the title", () => {
    const detailed = thread({
      title: "Old title",
      artifacts: ["reports/mobile-summary.md"],
      messages: [{ type: "ai", content: "Complete" }],
    });
    const summary = thread({ title: "Current title" });

    expect(mergeThreadSnapshot(detailed, summary).values).toEqual({
      title: "Current title",
      artifacts: ["reports/mobile-summary.md"],
      messages: [{ type: "ai", content: "Complete" }],
    });
  });
});
