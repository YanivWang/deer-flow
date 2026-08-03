<script setup lang="ts">
import type { SettingsPreferencesController } from "../../../features/settings/preferences/use-settings-preferences";

const props = defineProps<{
  preferences: SettingsPreferencesController;
}>();

function updateNotificationEnabled(event: Event) {
  props.preferences.setNotificationEnabled(
    event.target instanceof HTMLInputElement ? event.target.checked : false,
  );
}
</script>

<template>
  <h2>通知</h2>
  <p data-testid="vue-settings-notification-anchor">
    浏览器通知会作为当前浏览器的本地偏好保存。
  </p>
  <p
    v-if="preferences.notificationPermission.value === 'unsupported'"
    class="workspace-notice"
    data-testid="vue-settings-notification-unsupported"
  >
    当前浏览器不支持 Notification API。
  </p>
  <template v-else>
    <dl class="settings-notification-status" data-testid="vue-settings-notification-status">
      <dt>浏览器权限</dt>
      <dd>{{ preferences.notificationPermission.value }}</dd>
      <dt>DeerFlow 偏好</dt>
      <dd>{{ preferences.notificationEnabled.value ? "已启用" : "已禁用" }}</dd>
    </dl>
    <button
      v-if="preferences.notificationPermission.value === 'default'"
      class="workspace-button workspace-button--primary"
      data-testid="vue-settings-notification-request"
      type="button"
      @click="preferences.requestNotificationPermission"
    >
      请求权限
    </button>
    <p
      v-if="preferences.notificationPermission.value === 'denied'"
      class="workspace-notice"
      data-testid="vue-settings-notification-denied"
    >
      浏览器通知权限已被拒绝。请在浏览器站点设置中启用通知。
    </p>
    <label class="settings-notification-toggle" data-testid="vue-settings-notification-toggle-row">
      <input
        :checked="preferences.notificationEnabled.value"
        data-testid="vue-settings-notification-toggle"
        :disabled="preferences.notificationPermission.value !== 'granted'"
        type="checkbox"
        @change="updateNotificationEnabled"
      >
      <span>启用 DeerFlow 通知</span>
    </label>
    <button
      class="workspace-button"
      data-testid="vue-settings-notification-test"
      :disabled="preferences.notificationPermission.value !== 'granted' || !preferences.notificationEnabled.value"
      type="button"
      @click="preferences.sendTestNotification"
    >
      发送测试通知
    </button>
    <p
      v-if="preferences.notificationMessage.value"
      class="settings-success"
      data-testid="vue-settings-notification-message"
    >
      {{ preferences.notificationMessage.value }}
    </p>
  </template>
</template>
