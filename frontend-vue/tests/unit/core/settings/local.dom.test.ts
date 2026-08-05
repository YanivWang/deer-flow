/*
  由 scripts/rstest-to-vitest.mjs 从 frontend/tests/unit/core/settings/local.test.ts 机械生成。
  基线 27a425b0 · 改动仅限 @rstest/core → vitest、rs.* → vi.*。
  勿手改：make codemod-check 会红。需要为 Vue 侧适配就登记进 HAND_MAINTAINED。
*/

import { afterEach, expect, vi, test } from "vitest";

import {
  DEFAULT_LOCAL_SETTINGS,
  getLocalSettings,
  getThreadModelName,
  saveLocalSettings,
  saveThreadModelName,
} from "@/core/settings/local";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("defaults token usage to header total plus per-turn breakdown", () => {
  expect(DEFAULT_LOCAL_SETTINGS.tokenUsage).toEqual({
    headerTotal: true,
    inlineMode: "per_turn",
  });
});

test("falls back when localStorage access is blocked", () => {
  vi.stubGlobal("window", {
    get localStorage() {
      throw new DOMException("Blocked", "SecurityError");
    },
  });

  expect(getLocalSettings()).toEqual(DEFAULT_LOCAL_SETTINGS);
  expect(getThreadModelName("thread-1")).toBeUndefined();
  expect(() => saveLocalSettings(DEFAULT_LOCAL_SETTINGS)).not.toThrow();
  expect(() => saveThreadModelName("thread-1", "model-1")).not.toThrow();
});
