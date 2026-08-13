import { onMounted, readonly, ref } from "vue";

import {
  getBaseSettingsSnapshot,
  updateLocalSettings,
} from "@/core/settings/store";

const permission = ref<NotificationPermission>("default");
const supported = ref(false);
let lastNotificationTime: number | null = null;

function syncSupport() {
  supported.value = typeof window !== "undefined" && "Notification" in window;
  if (supported.value) permission.value = Notification.permission;
}

export function useNotifications() {
  onMounted(syncSupport);

  async function requestPermission() {
    syncSupport();
    if (!supported.value) return "denied" as NotificationPermission;
    const result = await Notification.requestPermission();
    permission.value = result;
    if (result === "granted") {
      updateLocalSettings("notification", { enabled: true });
    }
    return result;
  }

  function showNotification(title: string, options?: NotificationOptions) {
    syncSupport();
    if (!supported.value || !getBaseSettingsSnapshot().notification.enabled)
      return;
    permission.value = Notification.permission;
    if (permission.value !== "granted") return;
    const now = Date.now();
    if (lastNotificationTime !== null && now - lastNotificationTime < 1000)
      return;
    lastNotificationTime = now;
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  return {
    permission: readonly(permission),
    supported: readonly(supported),
    requestPermission,
    showNotification,
  };
}
