import { describe, expect, it } from "vitest";

import { THREAD_HISTORY_QUERY_POLICY } from "@/core/threads/history";

describe("thread history query policy", () => {
  it("does not refetch immutable pages on window focus", () => {
    expect(THREAD_HISTORY_QUERY_POLICY).toEqual({
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1_000,
    });
  });
});
