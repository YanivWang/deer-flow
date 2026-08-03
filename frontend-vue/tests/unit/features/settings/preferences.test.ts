import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useSettingsPreferences,
  type SettingsPreferencesController,
} from "../../../../app/features/settings/preferences/use-settings-preferences";

describe("useSettingsPreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("persists theme, locale, and notification preference through one controller", async () => {
    const preferences = await mountPreferencesHarness();

    preferences.updateTheme("dark");
    preferences.setLocale("zh-CN");
    preferences.setNotificationEnabled(false);

    expect(preferences.resolvedTheme.value).toBe("dark");
    expect(preferences.appLocale.value).toBe("zh-CN");
    expect(JSON.parse(window.localStorage.getItem("deerflow.vue.workspace-preferences") ?? "{}"))
      .toEqual({
        appearance: { locale: "zh-CN", theme: "dark" },
        notification: { enabled: false },
      });
  });

  it("requests permission and sends localized test notification only when enabled", async () => {
    const notifications: Array<{ body?: string; title: string }> = [];
    let permission: NotificationPermission = "default";
    const TestNotification = vi.fn(function testNotification(
      title: string,
      options?: NotificationOptions,
    ) {
      notifications.push({ body: options?.body, title });
    }) as unknown as typeof Notification;
    Object.defineProperty(TestNotification, "permission", {
      configurable: true,
      get: () => permission,
    });
    TestNotification.requestPermission = vi.fn(async () => {
      permission = "granted";
      return permission;
    });
    vi.stubGlobal("Notification", TestNotification);
    const preferences = await mountPreferencesHarness();

    await preferences.requestNotificationPermission();
    preferences.setNotificationEnabled(true);
    preferences.sendTestNotification();
    await flushPromises();

    expect(notifications).toEqual([
      { body: "Test body", title: "Test title" },
    ]);
    expect(preferences.notificationMessage.value).toContain("已发送");
  });
});

async function mountPreferencesHarness(): Promise<SettingsPreferencesController> {
  let preferences: SettingsPreferencesController | undefined;
  const appThemeMode = ref<"light" | "dark">("light");
  const appLocale = ref<"en-US" | "zh-CN">("en-US");
  const Probe = defineComponent({
    setup() {
      preferences = useSettingsPreferences({
        appLocale,
        appThemeMode,
        notificationBody: () => "Test body",
        notificationTitle: () => "Test title",
      });
      return () => h("div");
    },
  });
  mount(Probe);
  if (!preferences) {
    throw new Error("preferences controller was not created");
  }
  return preferences;
}
