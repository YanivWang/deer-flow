/*
  【文件职责】     锁定 OIDC callback 的 session 分类与安全回跳决策。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     app/core/auth/callback · next-path
  【边界与注意】   纯决策测试不替代 Nuxt DOM 与浏览器跳转测试。
*/

import { describe, expect, it } from "vitest";

import { resolveAuthCallback } from "@/core/auth/callback";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  system_role: "admin" as const,
  needs_setup: false,
  oauth_provider: null,
};

describe("resolveAuthCallback", () => {
  it("accepts an authenticated session and a safe local next path", () => {
    expect(
      resolveAuthCallback(
        { tag: "authenticated", user: USER },
        "/workspace/chats/thread-1?view=detail#answer",
      ),
    ).toEqual({
      status: "success",
      location: "/workspace/chats/thread-1?view=detail#answer",
    });
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example/phish",
    "/\\evil.example/phish",
    "javascript:alert(1)",
  ])("falls back to the workspace for unsafe next %s", (next) => {
    expect(
      resolveAuthCallback({ tag: "authenticated", user: USER }, next),
    ).toEqual({ status: "success", location: "/workspace" });
  });

  it("sends a 401 session result to the explicit SSO failure route", () => {
    expect(
      resolveAuthCallback({ tag: "unauthenticated" }, "/workspace"),
    ).toEqual({
      status: "unauthenticated",
      location: "/login?error=sso_failed",
    });
  });

  it("keeps Gateway failure distinct and preserves only a safe retry target", () => {
    expect(
      resolveAuthCallback({ tag: "unavailable" }, "/workspace/chats/thread-1"),
    ).toEqual({
      status: "unavailable",
      location:
        "/login?error=gateway_unavailable&next=%2Fworkspace%2Fchats%2Fthread-1",
    });
    expect(
      resolveAuthCallback({ tag: "unavailable" }, "https://evil.example"),
    ).toEqual({
      status: "unavailable",
      location: "/login?error=gateway_unavailable&next=%2Fworkspace",
    });
  });
});
