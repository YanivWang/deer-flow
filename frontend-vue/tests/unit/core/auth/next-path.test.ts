/*
  由 scripts/rstest-to-vitest.mjs 从 frontend/tests/unit/core/auth/next-path.test.ts 机械生成。
  基线 27a425b0 · 改动仅限 @rstest/core → vitest、rs.* → vi.*。
  勿手改：make codemod-check 会红。需要为 Vue 侧适配就登记进 HAND_MAINTAINED。
*/

import { describe, expect, test } from "vitest";

import {
  resolveAuthNextPath,
  validateAuthNextPath,
} from "@/core/auth/next-path";

describe("auth next path validation", () => {
  test("accepts local absolute paths", () => {
    expect(validateAuthNextPath("/workspace")).toBe("/workspace");
    expect(validateAuthNextPath("/workspace/chats/new?tab=recent#top")).toBe(
      "/workspace/chats/new?tab=recent#top",
    );
  });

  test("rejects external and ambiguous redirects", () => {
    expect(validateAuthNextPath(null)).toBeNull();
    expect(validateAuthNextPath("workspace")).toBeNull();
    expect(validateAuthNextPath("//evil.example")).toBeNull();
    expect(validateAuthNextPath("https://evil.example")).toBeNull();
    expect(validateAuthNextPath("/:evil")).toBeNull();
    expect(validateAuthNextPath("/\\evil.example")).toBeNull();
    expect(validateAuthNextPath("/foo\\bar")).toBeNull();
  });

  test("falls back for unsafe paths", () => {
    expect(resolveAuthNextPath("/\\evil.example")).toBe("/workspace");
    expect(resolveAuthNextPath("/safe", "/fallback")).toBe("/safe");
  });
});
