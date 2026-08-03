import { computed, ref } from "vue";

import {
  changePassword,
  fetchCurrentUser,
  logoutAndRedirect,
  type AuthUser,
} from "../../../core/auth/client";

export type SettingsAccountOptions = {
  push: (path: string) => Promise<unknown>;
};

export function useSettingsAccount(options: SettingsAccountOptions) {
  const user = ref<AuthUser | null>(null);
  const accountLoading = ref(false);
  const accountError = ref("");
  const accountMessage = ref("");
  const currentPassword = ref("");
  const newPassword = ref("");
  const confirmPassword = ref("");
  const passwordLoading = ref(false);
  const isSsoUser = computed(() => Boolean(user.value?.oauth_provider));

  async function load() {
    accountLoading.value = true;
    accountError.value = "";
    try {
      user.value = await fetchCurrentUser();
    } catch (error) {
      accountError.value = error instanceof Error ? error.message : "加载账户失败。";
    } finally {
      accountLoading.value = false;
    }
  }

  async function submitPasswordChange() {
    accountError.value = "";
    accountMessage.value = "";
    if (newPassword.value !== confirmPassword.value) {
      accountError.value = "两次输入的新密码不一致。";
      return;
    }
    if (newPassword.value.length < 8) {
      accountError.value = "新密码至少需要 8 个字符。";
      return;
    }

    passwordLoading.value = true;
    try {
      await changePassword({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      });
      accountMessage.value = "密码已修改。";
      currentPassword.value = "";
      newPassword.value = "";
      confirmPassword.value = "";
    } catch (error) {
      accountError.value = error instanceof Error ? error.message : "修改密码失败。";
    } finally {
      passwordLoading.value = false;
    }
  }

  async function logout() {
    await logoutAndRedirect({
      applyUser: (nextUser) => {
        user.value = nextUser;
      },
      push: options.push,
    });
  }

  function setConfirmPassword(value: string) {
    confirmPassword.value = value;
  }

  function setCurrentPassword(value: string) {
    currentPassword.value = value;
  }

  function setNewPassword(value: string) {
    newPassword.value = value;
  }

  return {
    accountError,
    accountLoading,
    accountMessage,
    confirmPassword,
    currentPassword,
    isSsoUser,
    load,
    logout,
    newPassword,
    passwordLoading,
    setConfirmPassword,
    setCurrentPassword,
    setNewPassword,
    submitPasswordChange,
    user,
  };
}

export type SettingsAccountController = ReturnType<typeof useSettingsAccount>;
