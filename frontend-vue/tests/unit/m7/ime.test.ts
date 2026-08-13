import { describe, expect, it } from "vitest";

import { isImeComposing } from "@/core/input/ime";

describe("M7 isImeComposing", () => {
  it.each([
    [{ isComposing: true, keyCode: 13 }, false],
    [{ isComposing: false, keyCode: 229 }, false],
    [{ isComposing: false, keyCode: 13 }, true],
  ])("protects composition variants", (event, active) => {
    expect(isImeComposing(event, active)).toBe(true);
  });

  it("allows ordinary Enter", () => {
    expect(isImeComposing({ isComposing: false, keyCode: 13 })).toBe(false);
  });
});
