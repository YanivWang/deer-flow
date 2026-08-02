import { describe, expect, it } from "vitest";

import { decideCoalesce, STREAM_RENDER_COALESCE_MS } from "../../../../app/core/threads/coalesce";

describe("stream render coalescing", () => {
  it("flushes the first pending update immediately", () => {
    expect(decideCoalesce(100, undefined, true)).toEqual({ delayMs: 0, shouldFlush: true });
  });

  it("holds updates until the coalescing window expires", () => {
    expect(decideCoalesce(120, 100, true)).toEqual({
      delayMs: STREAM_RENDER_COALESCE_MS - 20,
      shouldFlush: false,
    });
    expect(decideCoalesce(180, 100, true)).toEqual({ delayMs: 0, shouldFlush: true });
  });

  it("does not schedule a flush without a pending update", () => {
    expect(decideCoalesce(180, 100, false)).toEqual({ delayMs: 0, shouldFlush: false });
  });
});
