<script setup lang="ts">
/*
  【文件职责】     管理浏览器通知权限与本地偏好。
  【架构位置】     L3
  【主要导出】     默认 NotificationSettings 组件
  【依赖关系】     useNotifications · settings store · ui/switch
  【边界与注意】   N2 产品接线，不属于 L2。
*/
import { onBeforeUnmount, ref } from "vue";

import SettingsSection from "./SettingsSection.vue";
import { Switch } from "@/components/ui/switch";
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

function toggle(next: boolean) {
  enabled.value = next;
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
  <SettingsSection
    v-if="!notifications.supported.value"
    :title="$i18n.t.value.settings.notification.title"
    :description="$i18n.t.value.settings.notification.description"
  >
    <p class="text-muted-foreground text-sm">
      {{ $i18n.t.value.settings.notification.notSupported }}
    </p>
  </SettingsSection>
  <SettingsSection v-else :title="$i18n.t.value.settings.notification.title">
    <template #description>
      <div class="flex items-center gap-2">
        <div>{{ $i18n.t.value.settings.notification.description }}</div>
        <div>
          <Switch
            :aria-label="$i18n.t.value.settings.notification.title"
            :model-value="
              notifications.permission.value === 'granted' && enabled
            "
            :disabled="notifications.permission.value !== 'granted'"
            @update:model-value="toggle"
          />
        </div>
      </div>
    </template>
    <div class="flex flex-col gap-4">
      <button
        v-if="notifications.permission.value === 'default'"
        type="button"
        class="bg-primary text-primary-foreground rounded-md px-3 py-2"
        @click="requestPermission"
      >
        {{ $i18n.t.value.settings.notification.requestPermission }}
      </button>
      <p
        v-if="notifications.permission.value === 'denied'"
        class="rounded-md border border-amber-300 p-3 text-sm"
      >
        {{ $i18n.t.value.settings.notification.deniedHint }}
      </p>
      <div
        v-if="notifications.permission.value === 'granted' && enabled"
        class="flex flex-col gap-4"
      >
        <button
          type="button"
          class="rounded-md border px-3 py-2"
          @click="sendTestNotification"
        >
          {{ $i18n.t.value.settings.notification.testButton }}
        </button>
      </div>
    </div>
  </SettingsSection>
</template>
