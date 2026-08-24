/*
  【文件职责】     锁定 workspace auth-disabled 的纯决策。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     消费 decideAuthNavigation
  【边界与注意】   只证明决策；浏览器跳转由 M0 Playwright 验证。
*/

import { describe, expect, it } from "vitest";
import {
  buildLoginLocation,
  decideAuthNavigation,
  isEnabledRuntimeFlag,
} from "../../../app/core/auth/decision";

describe("isEnabledRuntimeFlag", () => {
  it.each([true, 1, "1", "true"])(
    "accepts enabled runtime value %s",
    (value) => {
      expect(isEnabledRuntimeFlag(value)).toBe(true);
    },
  );

  it.each([false, 0, "0", "false", "", undefined])(
    "rejects disabled runtime value %s",
    (value) => {
      expect(isEnabledRuntimeFlag(value)).toBe(false);
    },
  );
});

describe("decideAuthNavigation", () => {
  it("allows public routes without authentication", () => {
    expect(
      decideAuthNavigation({
        path: "/about",
        authDisabled: false,
        authenticated: false,
      }),
    ).toBe("allow");
  });

  it("allows workspace when auth is explicitly disabled", () => {
    expect(
      decideAuthNavigation({
        path: "/workspace",
        authDisabled: true,
        authenticated: false,
      }),
    ).toBe("allow");
  });

  it("redirects an unauthenticated workspace request", () => {
    expect(
      decideAuthNavigation({
        path: "/workspace/chats/new",
        authDisabled: false,
        authenticated: false,
      }),
    ).toBe("login");
  });
});

describe("buildLoginLocation（回跳目标的安全校验）", () => {
  it("合法的站内路径原样带上", () => {
    expect(buildLoginLocation("/workspace/chats/abc")).toBe(
      "/login?redirect=%2Fworkspace%2Fchats%2Fabc",
    );
  });

  // 三类 open-redirect 构造。校验不过时**不带 query**——原样透传就是漏洞本身。
  it.each([
    "//evil.example.com",
    "/\\evil.example.com",
    "https://evil.example.com",
    "http:/evil",
    "",
    null,
    undefined,
  ])("拒绝不可信的回跳目标 %s", (candidate) => {
    expect(buildLoginLocation(candidate)).toBe("/login");
  });

  it("与 validateAuthNextPath 共用一套规则，不另写一份", async () => {
    const { validateAuthNextPath } =
      await import("../../../app/core/auth/next-path");
    for (const candidate of ["/a", "//b", "/c\\d", "/e:f", "/ok/path"]) {
      const safe = validateAuthNextPath(candidate);
      expect(buildLoginLocation(candidate)).toBe(
        safe === null
          ? "/login"
          : `/login?redirect=${encodeURIComponent(safe)}`,
      );
    }
  });
});
