import { describe, expect, it } from "vitest";

import { formatThreadUpdatedAt } from "../../../../app/entities/thread/model";

describe("thread entity model", () => {
  it("formats valid Gateway timestamps for the chat list", () => {
    expect(formatThreadUpdatedAt("2026-08-03T01:02:03Z")).toBe("2026-08-03 01:02");
  });

  it("keeps an invalid Gateway timestamp visible instead of hiding it", () => {
    expect(formatThreadUpdatedAt("not-a-timestamp")).toBe("not-a-timestamp");
  });
});
