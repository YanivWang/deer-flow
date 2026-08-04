/*
  【文件职责】     锁定 workspace auth-disabled 的纯决策。
  【对应 frontend/】 frontend/src/core/auth/auth-disabled-user.ts
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     消费 decideAuthNavigation
  【边界与注意】   只证明决策；浏览器跳转由 M0 Playwright 验证。
*/

import { describe, expect, it } from "vitest";
import {
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
