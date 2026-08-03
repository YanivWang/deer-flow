import { computed, onMounted, ref, type Ref } from "vue";

import {
  applyThemePreference,
  readWorkspacePreferences,
  writeWorkspacePreferences,
  type LocalePreference,
  type ThemePreference,
} from "../../../core/settings/preferences";

export type SettingsPreferencesOptions = {
  appLocale: Ref<LocalePreference>;
  appThemeMode: Ref<"light" | "dark">;
  notificationBody: () => string;
  notificationTitle: () => string;
};

export function useSettingsPreferences(options: SettingsPreferencesOptions) {
  const { appLocale, appThemeMode } = options;
  const preferences = ref(readWorkspacePreferences());
  const resolvedTheme = ref<"light" | "dark">("light");
  const notificationPermission = ref<NotificationPermission | "unsupported">("default");
  const notificationMessage = ref("");
  const themeOptions: ThemePreference[] = ["system", "light", "dark"];
  const localeOptions: Array<{ label: string; value: LocalePreference }> = [
    { label: "英文", value: "en-US" },
    { label: "简体中文", value: "zh-CN" },
  ];
  const notificationEnabled = computed(() => preferences.value.notification.enabled);

  function initialize() {
    resolvedTheme.value = applyThemePreference(preferences.value.appearance.theme);
    appThemeMode.value = resolvedTheme.value;
    appLocale.value = preferences.value.appearance.locale;
    notificationPermission.value = readNotificationPermission();
  }

  function updateTheme(theme: ThemePreference) {
    preferences.value = {
      ...preferences.value,
      appearance: {
        ...preferences.value.appearance,
        theme,
      },
    };
    writeWorkspacePreferences(preferences.value);
    resolvedTheme.value = applyThemePreference(theme);
    appThemeMode.value = resolvedTheme.value;
  }

  function setLocale(value: string) {
    if (value !== "en-US" && value !== "zh-CN") {
      return;
    }
    const locale = value as LocalePreference;
    preferences.value = {
      ...preferences.value,
      appearance: {
        ...preferences.value.appearance,
        locale,
      },
    };
    writeWorkspacePreferences(preferences.value);
    appLocale.value = locale;
  }

  async function requestNotificationPermission() {
    notificationMessage.value = "";
    const api = readNotificationApi();
    if (!api) {
      notificationPermission.value = "unsupported";
      return;
    }
    notificationPermission.value = await api.requestPermission();
  }

  function setNotificationEnabled(enabled: boolean) {
    preferences.value = {
      ...preferences.value,
      notification: { enabled },
    };
    writeWorkspacePreferences(preferences.value);
    notificationMessage.value = "通知偏好已保存。";
  }

  function sendTestNotification() {
    notificationMessage.value = "";
    const api = readNotificationApi();
    if (!api) {
      notificationPermission.value = "unsupported";
      return;
    }
    notificationPermission.value = api.permission;
    if (api.permission !== "granted") {
      notificationMessage.value = "请先授予浏览器通知权限。";
      return;
    }
    if (!notificationEnabled.value) {
      notificationMessage.value = "请先启用 DeerFlow 通知。";
      return;
    }
    new api(options.notificationTitle(), {
      body: options.notificationBody(),
    });
    notificationMessage.value = "测试通知已发送。";
  }

  onMounted(initialize);

  return {
    appLocale,
    appThemeMode,
    initialize,
    localeOptions,
    notificationEnabled,
    notificationMessage,
    notificationPermission,
    preferences,
    requestNotificationPermission,
    resolvedTheme,
    sendTestNotification,
    setLocale,
    setNotificationEnabled,
    themeOptions,
    updateTheme,
  };
}

export type SettingsPreferencesController = ReturnType<typeof useSettingsPreferences>;

function readNotificationPermission(): NotificationPermission | "unsupported" {
  return readNotificationApi()?.permission ?? "unsupported";
}

function readNotificationApi(): typeof Notification | null {
  return typeof Notification === "undefined" ? null : Notification;
}
