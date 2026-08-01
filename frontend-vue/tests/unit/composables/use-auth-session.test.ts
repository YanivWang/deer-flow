import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import { useAuthSession } from "../../../app/composables/use-auth-session";
import type { AuthUser } from "../../../app/core/auth/client";

const USER: AuthUser = {
  email: "user@example.com",
  id: "user-1",
  oauth_provider: null,
  system_role: "admin",
};

function createVisibilityDocument(visibilityState: DocumentVisibilityState = "visible") {
  let listener: (() => void) | undefined;
  return {
    document: {
      addEventListener: vi.fn((_event: string, callback: EventListenerOrEventListenerObject) => {
        listener = typeof callback === "function" ? callback : () => callback.handleEvent(new Event("visibilitychange"));
      }),
      get visibilityState() {
        return visibilityState;
      },
      removeEventListener: vi.fn(),
    } satisfies Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState">,
    emitVisibilityChange: () => listener?.(),
  };
}

describe("useAuthSession", () => {
  it("refreshes the current user and exposes authenticated state", async () => {
    const fetchUser = vi.fn(async () => USER);
    const session = useAuthSession({
      fetchUser,
      visibilityDocument: null,
    });

    expect(session.isAuthenticated.value).toBe(false);
    await session.refreshUser();

    expect(session.user.value).toEqual(USER);
    expect(session.isAuthenticated.value).toBe(true);
    expect(session.isLoading.value).toBe(false);
  });

  it("redirects protected workspace routes to the React-compatible login URL when session expires", async () => {
    const redirectToLogin = vi.fn();
    const session = useAuthSession({
      currentPath: () => "/workspace/chats/thread-a?panel=artifact",
      fetchUser: vi.fn(async () => null),
      initialUser: USER,
      redirectToLogin,
      visibilityDocument: null,
    });

    await session.refreshUser();

    expect(session.user.value).toBeNull();
    expect(redirectToLogin).toHaveBeenCalledWith(
      "/login?next=%2Fworkspace%2Fchats%2Fthread-a%3Fpanel%3Dartifact",
    );
  });

  it("does not redirect public pages when refresh returns unauthenticated", async () => {
    const redirectToLogin = vi.fn();
    const session = useAuthSession({
      currentPath: () => "/login",
      fetchUser: vi.fn(async () => null),
      redirectToLogin,
      visibilityDocument: null,
    });

    await session.refreshUser();

    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it("refreshes on visible-tab resume at most once per interval", async () => {
    let now = 100_000;
    const visibility = createVisibilityDocument();
    const fetchUser = vi.fn(async () => USER);
    const session = useAuthSession({
      fetchUser,
      initialUser: USER,
      now: () => now,
      visibilityDocument: visibility.document,
    });

    visibility.emitVisibilityChange();
    await flushPromises();
    visibility.emitVisibilityChange();
    await flushPromises();
    now += 60_001;
    visibility.emitVisibilityChange();
    await flushPromises();

    expect(fetchUser).toHaveBeenCalledTimes(2);
    session.stopVisibilityRefresh();
    const removeCall = visibility.document.removeEventListener.mock.calls[0];
    expect(removeCall?.[0]).toBe("visibilitychange");
    expect(typeof removeCall?.[1]).toBe("function");
  });

  it("keeps local user state mutable without storing credentials", () => {
    const session = useAuthSession({ visibilityDocument: null });

    session.applyUser(USER);
    expect(session.user.value?.email).toBe("user@example.com");

    session.applyUser(null);
    expect(session.user.value).toBeNull();
  });
});
