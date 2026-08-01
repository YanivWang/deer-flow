import { mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { useRouter } from "#app";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AuthCallbackPage from "../../../app/pages/auth/callback.vue";
import LoginPage from "../../../app/pages/login.vue";
import SetupPage from "../../../app/pages/setup.vue";

describe("Vue auth pages", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("logs in with local credentials and redirects to a safe next path", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ needs_setup: false, registration_enabled: true }))
      .mockResolvedValueOnce(Response.json({ providers: [] }))
      .mockResolvedValueOnce(Response.json({ id: "user-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const router = useRouter();
    const pushSpy = vi.spyOn(router, "push").mockResolvedValue();
    const wrapper = await mountSuspended(LoginPage, {
      route: "/login?next=%2Fworkspace%2Fchats%2Fthread-a",
    });
    await flushPromises();

    await wrapper.get('[data-testid="vue-login-email"]').setValue("user@example.com");
    await wrapper.get('[data-testid="vue-login-password"]').setValue("secret123");
    await wrapper.get('[data-testid="vue-login-remember"]').setValue(false);
    await wrapper.get('[data-testid="vue-login-form"]').trigger("submit");
    await flushPromises();

    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/v1/auth/login/local");
    expect(pushSpy).toHaveBeenCalledWith("/workspace/chats/thread-a");
  });

  it("shows admin setup entry point from setup-status", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ needs_setup: true, registration_enabled: false }))
      .mockResolvedValueOnce(Response.json({ providers: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = await mountSuspended(LoginPage, { route: "/login" });
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-login-needs-setup"]').text()).toContain(
      "管理员账号",
    );
    expect(wrapper.get('[data-testid="vue-login-needs-setup"]').attributes("role")).toBe(
      "status",
    );
    expect(wrapper.get('[data-testid="vue-login-setup-link"]').attributes("href")).toBe("/setup");
  });

  it("associates local login errors with the password field", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ needs_setup: false, registration_enabled: true }))
      .mockResolvedValueOnce(Response.json({ providers: [] }))
      .mockResolvedValueOnce(Response.json({ detail: "Invalid credentials" }, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(LoginPage, { route: "/login" });
    await flushPromises();

    await wrapper.get('[data-testid="vue-login-email"]').setValue("user@example.com");
    await wrapper.get('[data-testid="vue-login-password"]').setValue("wrong");
    await wrapper.get('[data-testid="vue-login-form"]').trigger("submit");
    await flushPromises();

    const error = wrapper.get('[data-testid="vue-login-error"]');
    expect(error.attributes("id")).toBe("vue-login-error-message");
    expect(error.attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="vue-login-password"]').attributes("aria-invalid")).toBe(
      "true",
    );
    expect(wrapper.get('[data-testid="vue-login-password"]').attributes("aria-describedby")).toBe(
      "vue-login-error-message",
    );
  });

  it("creates the first admin account and redirects to workspace", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ needs_setup: true }))
      .mockResolvedValueOnce(Response.json({ id: "admin-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const router = useRouter();
    const pushSpy = vi.spyOn(router, "push").mockResolvedValue();
    const wrapper = await mountSuspended(SetupPage, { route: "/setup" });
    await flushPromises();

    await wrapper.get('[data-testid="vue-setup-email"]').setValue("admin@example.com");
    await wrapper.get('[data-testid="vue-setup-password"]').setValue("password123");
    await wrapper.get('[data-testid="vue-setup-confirm-password"]').setValue("password123");
    await wrapper.get('[data-testid="vue-setup-form"]').trigger("submit");
    await flushPromises();

    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/auth/initialize");
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          email: "admin@example.com",
          password: "password123",
          remember_me: true,
        }),
        method: "POST",
      }),
    );
    expect(pushSpy).toHaveBeenCalledWith("/workspace");
  });

  it("associates setup password mismatch errors with both password fields", async () => {
    const fetchMock = vi.fn(async () => Response.json({ needs_setup: true }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(SetupPage, { route: "/setup" });
    await flushPromises();

    await wrapper.get('[data-testid="vue-setup-email"]').setValue("admin@example.com");
    await wrapper.get('[data-testid="vue-setup-password"]').setValue("password123");
    await wrapper.get('[data-testid="vue-setup-confirm-password"]').setValue("password456");
    await wrapper.get('[data-testid="vue-setup-form"]').trigger("submit");
    await flushPromises();

    const error = wrapper.get('[data-testid="vue-setup-error"]');
    expect(error.attributes("id")).toBe("vue-setup-error-message");
    expect(error.attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="vue-setup-password"]').attributes("aria-invalid")).toBe(
      "true",
    );
    expect(
      wrapper.get('[data-testid="vue-setup-confirm-password"]').attributes("aria-describedby"),
    ).toBe("vue-setup-error-message");
  });

  it("redirects setup visitors back to login after the system is initialized", async () => {
    const fetchMock = vi.fn(async () => Response.json({ needs_setup: false }));
    vi.stubGlobal("fetch", fetchMock);
    const router = useRouter();
    const replaceSpy = vi.spyOn(router, "replace").mockResolvedValue();

    await mountSuspended(SetupPage, { route: "/setup" });
    await flushPromises();

    expect(replaceSpy).toHaveBeenCalledWith("/login");
  });

  it("verifies SSO callback and rejects unsafe next redirects", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => Response.json({ id: "user-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const router = useRouter();
    const replaceSpy = vi.spyOn(router, "replace").mockResolvedValue();
    const wrapper = await mountSuspended(AuthCallbackPage, {
      route: "/auth/callback?next=https%3A%2F%2Fevil.test",
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-auth-callback-success"]').text()).toContain(
      "正在跳转",
    );
    expect(wrapper.get('[data-testid="vue-auth-callback-success"]').attributes("role")).toBe(
      "status",
    );
    await vi.advanceTimersByTimeAsync(300);

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/me", { credentials: "include" });
    expect(replaceSpy).toHaveBeenCalledWith("/workspace");
  });

  it("returns failed SSO callbacks to login with the React-compatible error code", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    const router = useRouter();
    const replaceSpy = vi.spyOn(router, "replace").mockResolvedValue();
    const wrapper = await mountSuspended(AuthCallbackPage, { route: "/auth/callback" });
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-auth-callback-error"]').text()).toContain(
      "认证失败",
    );
    expect(wrapper.get('[data-testid="vue-auth-callback-error"]').attributes("role")).toBe(
      "alert",
    );
    await vi.advanceTimersByTimeAsync(1500);

    expect(replaceSpy).toHaveBeenCalledWith("/login?error=sso_failed");
  });
});
