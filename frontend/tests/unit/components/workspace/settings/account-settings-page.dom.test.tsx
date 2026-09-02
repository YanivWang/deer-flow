import { afterEach, describe, expect, it, rs } from "@rstest/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AccountSettingsPage } from "@/components/workspace/settings/account-settings-page";

rs.mock("@/core/i18n/hooks", () => ({
  useI18n: () => ({
    t: {
      settings: {
        account: {
          profileTitle: "Profile",
          email: "Email",
          role: "Role",
          ssoProvider: "SSO provider",
          changePasswordTitle: "Change password",
          changePasswordDescription: "Pick a new one",
          ssoPasswordDescription: "Managed by your provider",
          ssoPasswordMessage: "Managed by {provider}",
          currentPassword: "Current password",
          newPassword: "New password",
          confirmNewPassword: "Confirm new password",
          passwordMismatch: "Passwords do not match",
          passwordTooShort: "Password is too short",
          passwordChangedSuccess: "Password updated",
          networkError: "Network error",
          updating: "Updating",
          updatePassword: "Update password",
          signOut: "Sign out",
        },
      },
    },
  }),
}));

rs.mock("@/core/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { email: "a@b.test", system_role: "admin" },
    logout: rs.fn(),
  }),
}));

afterEach(cleanup);

describe("AccountSettingsPage feedback regions", () => {
  // Without a live region the outcome of the submit is visible only. A screen
  // reader stays silent, so the user cannot tell whether anything happened.
  it("announces a validation failure through an alert region", () => {
    render(<AccountSettingsPage />);
    fireEvent.change(screen.getByPlaceholderText("New password"), {
      target: { value: "longenough1" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirm new password"), {
      target: { value: "different111" },
    });
    // 直接派发 submit：在这个测试环境里点击 submit 按钮不会连带触发表单的
    // submit 事件，于是处理器根本没跑——量出来会像「守卫没生效」。
    fireEvent.submit(
      screen.getByRole("button", { name: "Update password" }).closest("form")!,
    );

    expect(screen.getByRole("alert").textContent).toBe(
      "Passwords do not match",
    );
  });
});
