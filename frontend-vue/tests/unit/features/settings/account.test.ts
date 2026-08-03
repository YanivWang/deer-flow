import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useSettingsAccount,
  type SettingsAccountController,
} from "../../../../app/features/settings/account/use-settings-account";

describe("useSettingsAccount", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads the profile and preserves validation before the password request", async () => {
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
      .mockResolvedValueOnce(Response.json({ message: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    const account = mountAccountHarness();

    await account.load();
    expect(account.user.value?.email).toBe("user@example.com");

    account.newPassword.value = "short";
    account.confirmPassword.value = "different";
    await account.submitPasswordChange();
    expect(account.accountError.value).toContain("不一致");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    account.currentPassword.value = "old-password";
    account.newPassword.value = "new-password";
    account.confirmPassword.value = "new-password";
    await account.submitPasswordChange();
    await flushPromises();

    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/auth/change-password");
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          current_password: "old-password",
          new_password: "new-password",
        }),
        method: "POST",
      }),
    );
    expect(account.accountMessage.value).toBe("密码已修改。");
  });

  it("clears the local user and routes home after logout", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(
        Response.json({ id: "user-1", email: "user@example.com", system_role: "user" }),
      )
      .mockResolvedValueOnce(Response.json({ message: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    const push = vi.fn<(path: string) => Promise<unknown>>().mockResolvedValue(undefined);
    const account = mountAccountHarness(push);

    await account.load();
    await account.logout();

    expect(account.user.value).toBeNull();
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/auth/logout");
    expect(push).toHaveBeenCalledWith("/");
  });
});

function mountAccountHarness(
  push = vi.fn<(path: string) => Promise<unknown>>().mockResolvedValue(undefined),
): SettingsAccountController {
  let account: SettingsAccountController | undefined;
  const Probe = defineComponent({
    setup() {
      account = useSettingsAccount({ push });
      return () => h("div");
    },
  });
  mount(Probe);
  if (!account) {
    throw new Error("account controller was not created");
  }
  return account;
}
