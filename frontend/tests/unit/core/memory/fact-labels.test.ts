import { describe, expect, it } from "@rstest/core";

import {
  factActionLabel,
  truncateFactPreview,
} from "@/core/memory/fact-labels";

describe("truncateFactPreview", () => {
  it("collapses whitespace and leaves short content alone", () => {
    expect(truncateFactPreview("  a   b\nc  ")).toBe("a b c");
  });

  it("ellipsises past the limit, never exceeding it", () => {
    const long = "x".repeat(200);
    const preview = truncateFactPreview(long);
    expect(preview).toHaveLength(140);
    expect(preview.endsWith("...")).toBe(true);
  });

  it("degrades to a hard slice when the limit cannot fit an ellipsis", () => {
    expect(truncateFactPreview("abcdef", 2)).toBe("ab");
  });
});

describe("factActionLabel", () => {
  // Three rows otherwise ship three identical "Edit" buttons, so a screen
  // reader announces the same name for controls with different effects.
  it("names the row the button acts on, so no two names collide", () => {
    const labels = [
      { content: "Prefers Chinese" },
      { content: "Uses the monorepo" },
    ].map((fact) => factActionLabel("Edit", fact));
    expect(labels).toEqual([
      "Edit: Prefers Chinese",
      "Edit: Uses the monorepo",
    ]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("truncates so one long fact cannot become the whole name", () => {
    const label = factActionLabel("Delete", { content: "y".repeat(300) });
    expect(label.startsWith("Delete: ")).toBe(true);
    expect(label).toHaveLength("Delete: ".length + 140);
  });
});
