<script setup lang="ts">
/*
  【文件职责】     管理浏览器通知权限与本地偏好。
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
const { $i18n } = useNuxtApp();
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

function sendTestNotification() {
  notifications.showNotification(
    $i18n.t.value.settings.notification.testTitle,
    { body: $i18n.t.value.settings.notification.testBody },
  );
}
</script>

<template>
  <section class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold">
        {{ $i18n.t.value.settings.notification.title }}
      </h2>
      <p class="text-muted-foreground text-sm">
        {{ $i18n.t.value.settings.notification.description }}
      </p>
    </div>
    <p
      v-if="!notifications.supported.value"
      class="text-muted-foreground text-sm"
    >
      {{ $i18n.t.value.settings.notification.notSupported }}
    </p>
    <template v-else>
      <button
        v-if="notifications.permission.value === 'default'"
        type="button"
        class="bg-primary text-primary-foreground rounded-md px-3 py-2"
        @click="requestPermission"
      >
        {{ $i18n.t.value.settings.notification.requestPermission }}
      </button>
      <p
        v-else-if="notifications.permission.value === 'denied'"
        class="rounded-md border border-amber-300 p-3 text-sm"
      >
        {{ $i18n.t.value.settings.notification.deniedHint }}
      </p>
      <label class="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          role="switch"
          :aria-label="$i18n.t.value.settings.notification.title"
          :checked="notifications.permission.value === 'granted' && enabled"
          :disabled="notifications.permission.value !== 'granted'"
          @change="toggle"
        />
        {{ $i18n.t.value.settings.notification.title }}
      </label>
      <button
        v-if="notifications.permission.value === 'granted' && enabled"
        type="button"
        class="rounded-md border px-3 py-2"
        @click="sendTestNotification"
      >
        {{ $i18n.t.value.settings.notification.testButton }}
      </button>
    </template>
  </section>
</template>
