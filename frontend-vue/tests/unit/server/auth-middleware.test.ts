import { describe, expect, it } from "vitest";

import { resolveServerAuthState, shouldProtectHtmlPath } from "../../../server/utils/auth-state";

describe("Nuxt auth boundary", () => {
  it("keeps workspace and callback paths protected in the production policy", () => {
    expect(shouldProtectHtmlPath("/workspace")).toBe(true);
    expect(shouldProtectHtmlPath("/workspace/chats/new")).toBe(true);
    expect(shouldProtectHtmlPath("/auth/callback")).toBe(true);
    expect(shouldProtectHtmlPath("/login")).toBe(false);
  });

  it("distinguishes missing and non-empty access cookies", () => {
    expect(resolveServerAuthState(undefined)).toEqual({ status: "missing" });
    expect(resolveServerAuthState("access-token")).toEqual({
      accessToken: "access-token",
      status: "authenticated",
    });
  });
});
