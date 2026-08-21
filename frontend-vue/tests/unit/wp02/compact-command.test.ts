import { describe, expect, it } from "vitest";

import { isCompactCommand } from "@/core/threads/compact-command";

describe("compact composer command", () => {
  it("matches the two React command spellings", () => {
    expect(isCompactCommand("/compact")).toBe(true);
    expect(isCompactCommand(" /context compact ")).toBe(true);
  });

  it("does not intercept normal chat text or arguments", () => {
    expect(isCompactCommand("compact")).toBe(false);
    expect(isCompactCommand("/compact now")).toBe(false);
  });
});
