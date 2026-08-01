import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildLoginRedirectPath,
  changePassword,
  fetchCurrentUser,
  initializeAdmin,
  logoutAndRedirect,
  loginLocal,
  logoutCurrentUser,
  parseAuthErrorPayload,
  resolveAuthNextPath,
} from "../../../../app/core/auth/client";

describe("auth client contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("allows only local absolute next paths", () => {
    expect(resolveAuthNextPath("/workspace/chats/thread-a")).toBe("/workspace/chats/thread-a");
    expect(resolveAuthNextPath("//evil.test")).toBe("/workspace");
    expect(resolveAuthNextPath("https://evil.test")).toBe("/workspace");
    expect(resolveAuthNextPath("/\\evil")).toBe("/workspace");
    expect(resolveAuthNextPath("/login:evil")).toBe("/workspace");
  });

  it("builds React-compatible login redirects for protected route refreshes", () => {
    expect(buildLoginRedirectPath("/workspace/chats/thread-a?panel=artifact")).toBe(
      "/login?next=%2Fworkspace%2Fchats%2Fthread-a%3Fpanel%3Dartifact",
    );
    expect(buildLoginRedirectPath("https://evil.test")).toBe("/login?next=%2Fworkspace");
  });

  it("posts local login as form-urlencoded with included credentials", async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: "user-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await loginLocal({
      email: "user@example.com",
      password: "secret123",
      rememberMe: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/login/local",
      expect.objectContaining({
        credentials: "include",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
      }),
    );
    const body = fetchMock.mock.calls[0]?.[1]?.body;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect((body as URLSearchParams).get("username")).toBe("user@example.com");
    expect((body as URLSearchParams).get("password")).toBe("secret123");
    expect((body as URLSearchParams).get("remember_me")).toBe("false");
  });

  it("posts first-admin initialization as JSON", async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: "admin-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await initializeAdmin({
      email: "admin@example.com",
      password: "password123",
      rememberMe: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/initialize",
      expect.objectContaining({
        body: JSON.stringify({
          email: "admin@example.com",
          password: "password123",
          remember_me: true,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
  });

  it("normalizes backend auth error envelopes", () => {
    expect(parseAuthErrorPayload({ detail: "Invalid credentials." })).toBe("Invalid credentials.");
    expect(parseAuthErrorPayload({ detail: { message: "Too many attempts." } })).toBe(
      "Too many attempts.",
    );
    expect(parseAuthErrorPayload({ message: "Setup already completed." })).toBe(
      "Setup already completed.",
    );
    expect(parseAuthErrorPayload(["broken"])).toBe("认证失败。");
  });

  it("loads current user and returns null for an unauthenticated session", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(
        Response.json({
          id: "user-1",
          email: "user@example.com",
          system_role: "admin",
          oauth_provider: null,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCurrentUser()).resolves.toMatchObject({
      email: "user@example.com",
      system_role: "admin",
    });
    await expect(fetchCurrentUser()).resolves.toBeNull();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/auth/me");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("changes password with JSON body and CSRF header", async () => {
    vi.stubGlobal("document", { cookie: "csrf_token=token-1" });
    const fetchMock = vi.fn(async () => Response.json({ message: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await changePassword({
      currentPassword: "old-password",
      newPassword: "new-password",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/change-password",
      expect.objectContaining({
        body: JSON.stringify({
          current_password: "old-password",
          new_password: "new-password",
        }),
        credentials: "include",
        method: "POST",
      }),
    );
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-CSRF-Token")).toBe("token-1");
  });

  it("posts logout and reports whether the Gateway cleared the session", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ message: "ok" }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(logoutCurrentUser()).resolves.toBe(true);
    await expect(logoutCurrentUser()).resolves.toBe(false);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/auth/logout");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ credentials: "include", method: "POST" }),
    );
  });

  it("clears local user state and uses SPA navigation when logout succeeds", async () => {
    const fetchMock = vi.fn(async () => Response.json({ message: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    const applyUser = vi.fn();
    const push = vi.fn(async () => undefined);
    const hardRedirect = vi.fn();

    await logoutAndRedirect({ applyUser, hardRedirect, push });

    expect(applyUser).toHaveBeenCalledWith(null);
    expect(push).toHaveBeenCalledWith("/");
    expect(hardRedirect).not.toHaveBeenCalled();
  });

  it("uses a hard redirect when logout fails so client subscriptions are discarded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    const push = vi.fn(async () => undefined);
    const hardRedirect = vi.fn();

    await logoutAndRedirect({ hardRedirect, push });

    expect(push).not.toHaveBeenCalled();
    expect(hardRedirect).toHaveBeenCalledWith("/");
  });
});
