import { describe, expect, it } from "vitest";

import { resolveServerAuthState, shouldProtectHtmlPath } from "../../server/utils/auth-state";

describe("Nitro auth middleware contract", () => {
  it("protects workspace HTML before the CSR app shell is served", () => {
    expect(shouldProtectHtmlPath("/workspace")).toBe(true);
    expect(shouldProtectHtmlPath("/workspace/chats/thread-a")).toBe(true);
    expect(shouldProtectHtmlPath("/auth/callback")).toBe(true);
    expect(shouldProtectHtmlPath("/login")).toBe(false);
    expect(shouldProtectHtmlPath("/setup")).toBe(false);
    expect(shouldProtectHtmlPath("/api/v1/auth/me")).toBe(false);
    expect(shouldProtectHtmlPath("/api/langgraph/threads")).toBe(false);
  });

  it("keeps the server-side auth state as a tagged union", () => {
    expect(resolveServerAuthState(undefined)).toEqual({ status: "missing" });
    expect(resolveServerAuthState("token")).toEqual({
      status: "authenticated",
      accessToken: "token",
    });
  });
});
