import { describe, expect, it } from "vitest";

import { createAsyncGeneration } from "@/core/async/generation";

describe("asynchronous stale guard", () => {
  it("rejects results replaced by a new request, route, stop, or unmount", () => {
    const guard = createAsyncGeneration();
    const first = guard.begin("thread-a/agent-a");
    expect(guard.isCurrent(first, "thread-a/agent-a")).toBe(true);

    const replacement = guard.begin("thread-a/agent-a");
    expect(guard.isCurrent(first, "thread-a/agent-a")).toBe(false);
    expect(guard.isCurrent(replacement, "thread-a/agent-a")).toBe(true);
    expect(guard.isCurrent(replacement, "thread-b/agent-a")).toBe(false);

    guard.invalidate();
    expect(guard.isCurrent(replacement, "thread-a/agent-a")).toBe(false);
  });
});
