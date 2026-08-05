/*
  由 scripts/rstest-to-vitest.mjs 从 frontend/tests/unit/core/tasks/presentation.test.ts 机械生成。
  基线 27a425b0 · 改动仅限 @rstest/core → vitest、rs.* → vi.*。
  勿手改：make codemod-check 会红。需要为 Vue 侧适配就登记进 HAND_MAINTAINED。
*/

import { describe, expect, it } from "vitest";

import {
  formatSubtaskTokenUsage,
  resolveSubtaskModelLabel,
} from "@/core/tasks/presentation";

describe("resolveSubtaskModelLabel", () => {
  it("prefers the configured display name and falls back to the model identifier", () => {
    expect(
      resolveSubtaskModelLabel("claude-3-7-sonnet", [
        {
          id: "model-1",
          name: "claude-3-7-sonnet",
          model: "claude-3-7-sonnet@20250219",
          display_name: "Claude 3.7 Sonnet",
        },
      ]),
    ).toBe("Claude 3.7 Sonnet");

    expect(resolveSubtaskModelLabel("unlisted-model", [])).toBe(
      "unlisted-model",
    );
  });

  it("formats only reported cumulative token usage", () => {
    expect(formatSubtaskTokenUsage(undefined)).toBeUndefined();
    expect(
      formatSubtaskTokenUsage({
        inputTokens: 10_000,
        outputTokens: 2_345,
        totalTokens: 12_345,
      }),
    ).toBe("12.3K");
  });
});
