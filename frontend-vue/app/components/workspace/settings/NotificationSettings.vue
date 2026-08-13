<script setup lang="ts">
/*
  【文件职责】     管理浏览器通知权限与本地偏好。
  【对应 frontend/】 src/components/workspace/settings/notification-settings.tsx
  【架构位置】     L3
  【主要导出】     默认 NotificationSettings 组件
  【依赖关系】     useNotifications · settings store
  【边界与注意】   N2 产品接线，不属于 L2。
*/
import { onBeforeUnmount, ref } from "vue";

import { useNotifications } from "@/composables/useNotifications";
import {
  getBaseSettingsSnapshot,
  subscribe,
  updateLocalSettings,
} from "@/core/settings/store";

const notifications = useNotifications();
const enabled = ref(getBaseSettingsSnapshot().notification.enabled);
const unsubscribe = subscribe(() => {
  enabled.value = getBaseSettingsSnapshot().notification.enabled;
});

onBeforeUnmount(unsubscribe);

async function requestPermission() {
  await notifications.requestPermission();
}

function toggle(event: Event) {
  enabled.value = (event.target as HTMLInputElement).checked;
  updateLocalSettings("notification", {
    enabled: enabled.value,
  });
}
</script>

<template>
  <section class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold">Notification</h2>
      <p class="text-muted-foreground text-sm">
        Receive a browser notification when an agent task finishes.
      </p>
    </div>
    <p
      v-if="!notifications.supported.value"
      class="text-muted-foreground text-sm"
    >
      Notifications are not supported in this browser.
    </p>
    <template v-else>
      <button
        v-if="notifications.permission.value === 'default'"
        type="button"
        class="bg-primary text-primary-foreground rounded-md px-3 py-2"
        @click="requestPermission"
      >
        Request notification permission
      </button>
      <p
        v-else-if="notifications.permission.value === 'denied'"
        class="rounded-md border border-amber-300 p-3 text-sm"
      >
        Notification permission was denied. Enable it in your browser settings.
      </p>
      <label class="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          role="switch"
          aria-label="Notification"
          :checked="notifications.permission.value === 'granted' && enabled"
          :disabled="notifications.permission.value !== 'granted'"
          @change="toggle"
        />
        Notification
      </label>
      <button
        v-if="notifications.permission.value === 'granted' && enabled"
        type="button"
        class="rounded-md border px-3 py-2"
        @click="
          notifications.showNotification('DeerFlow', {
            body: 'This is a test notification.',
          })
        "
      >
        Send test notification
      </button>
    </template>
  </section>
</template>
