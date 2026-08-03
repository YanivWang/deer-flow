<script setup lang="ts">
import type { SettingsAccountController } from "../../../features/settings/account/use-settings-account";

const props = defineProps<{
  account: SettingsAccountController;
}>();

const accountErrorId = "vue-settings-account-error-message";
const accountMessageId = "vue-settings-account-success-message";

function eventTargetValue(event: Event): string {
  return event.target instanceof HTMLInputElement ? event.target.value : "";
}

function updateCurrentPassword(event: Event) {
  props.account.setCurrentPassword(eventTargetValue(event));
}

function updateNewPassword(event: Event) {
  props.account.setNewPassword(eventTargetValue(event));
}

function updateConfirmPassword(event: Event) {
  props.account.setConfirmPassword(eventTargetValue(event));
}
</script>

<template>
  <h2>账户</h2>
  <p v-if="account.accountLoading.value">正在加载账户...</p>
  <dl v-else class="settings-account" data-testid="vue-settings-account-profile">
    <dt>邮箱</dt>
    <dd>{{ account.user.value?.email || "-" }}</dd>
    <dt>角色</dt>
    <dd>{{ account.user.value?.system_role || "-" }}</dd>
    <template v-if="account.isSsoUser.value">
      <dt>SSO</dt>
      <dd>{{ account.user.value?.oauth_provider }}</dd>
    </template>
  </dl>
  <p v-if="account.isSsoUser.value" class="workspace-notice" data-testid="vue-settings-account-sso">
    此账户使用 SSO，DeerFlow 无法在这里管理密码。
  </p>
  <form
    v-else
    class="settings-password-form"
    data-testid="vue-settings-password-form"
    @submit.prevent="account.submitPasswordChange"
  >
    <input
      :value="account.currentPassword.value"
      data-testid="vue-settings-current-password"
      placeholder="当前密码"
      type="password"
      @input="updateCurrentPassword"
    >
    <input
      :value="account.newPassword.value"
      data-testid="vue-settings-new-password"
      placeholder="新密码"
      type="password"
      @input="updateNewPassword"
    >
    <input
      :value="account.confirmPassword.value"
      data-testid="vue-settings-confirm-password"
      placeholder="确认新密码"
      type="password"
      @input="updateConfirmPassword"
    >
    <button class="workspace-button workspace-button--primary" :disabled="account.passwordLoading.value" type="submit">
      {{ account.passwordLoading.value ? "正在更新..." : "更新密码" }}
    </button>
  </form>
  <p
    v-if="account.accountError.value"
    :id="accountErrorId"
    class="workspace-error"
    role="alert"
    data-testid="vue-settings-account-error"
  >
    {{ account.accountError.value }}
  </p>
  <p
    v-if="account.accountMessage.value"
    :id="accountMessageId"
    class="settings-success"
    role="status"
    data-testid="vue-settings-account-message"
  >
    {{ account.accountMessage.value }}
  </p>
  <button
    class="workspace-button"
    data-testid="vue-settings-logout"
    type="button"
    @click="account.logout"
  >
    退出登录
  </button>
</template>
