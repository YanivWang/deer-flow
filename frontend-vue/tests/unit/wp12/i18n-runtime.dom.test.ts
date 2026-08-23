/*
  【文件职责】     固定 WP-12 locale 即时更新、cookie/lang 与已打开 Appearance UI 合同。
  【对应 frontend/】 core/i18n/context.tsx + hooks.ts
  【架构位置】     WP-12 Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     app/plugins/i18n.ts · AppearanceSettings.vue
  【边界与注意】   plugin 提供 ref/computed；dialog 不缓存第二份词典或 locale。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { computed, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AppearanceSettings from "@/components/workspace/settings/AppearanceSettings.vue";
import { clientTranslations } from "@/core/i18n/client-translations";
import { enUS } from "@/core/i18n/locales/en-US";
import { zhCN } from "@/core/i18n/locales/zh-CN";
import type { Locale } from "@/core/i18n/locale";

beforeEach(() => {
  document.cookie = "locale=; max-age=0; path=/";
  document.documentElement.lang = "";
  vi.stubGlobal("defineNuxtPlugin", (plugin: unknown) => plugin);
  vi.stubGlobal("useHead", vi.fn());
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("i18n plugin", () => {
  it("keeps locale, dictionary, cookie and document lang synchronized", async () => {
    document.cookie = "locale=en-US; path=/";
    const { default: plugin } = await import("@/plugins/i18n");
    const provided = (
      plugin as unknown as () => {
        provide: {
          i18n: {
            locale: { value: Locale };
            t: { value: typeof enUS };
            setLocale: (locale: Locale) => void;
          };
        };
      }
    )();
    const i18n = provided.provide.i18n;
    expect(i18n.t.value.settings.appearance.themeTitle).toBe(
      enUS.settings.appearance.themeTitle,
    );
    expect(document.documentElement.lang).toBe("en-US");

    i18n.setLocale("zh-CN");
    await flushPromises();
    expect(i18n.locale.value).toBe("zh-CN");
    expect(i18n.t.value.settings.appearance.themeTitle).toBe(
      zhCN.settings.appearance.themeTitle,
    );
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(document.cookie).toContain("locale=zh-CN");
    const headFactory = vi.mocked(useHead).mock.calls[0]?.[0] as () => {
      htmlAttrs: { lang: Locale };
    };
    expect(headFactory().htmlAttrs.lang).toBe("zh-CN");
  });
});

describe("AppearanceSettings", () => {
  it("updates an already-open panel immediately and delegates theme changes to the app owner", async () => {
    const locale = ref<Locale>("en-US");
    const t = computed(() => clientTranslations[locale.value]);
    const preference = ref<"system" | "light" | "dark">("system");
    const resolved = ref<"light" | "dark">("light");
    const setPreference = vi.fn((next: typeof preference.value) => {
      preference.value = next;
    });
    const i18n = {
      locale,
      t,
      setLocale(next: Locale) {
        locale.value = next;
      },
    };
    const theme = { preference, resolved, setPreference };
    vi.stubGlobal("useNuxtApp", () => ({ $i18n: i18n, $theme: theme }));

    const wrapper = mount(AppearanceSettings, {
      global: { config: { globalProperties: { $i18n: i18n, $theme: theme } } },
    });
    expect(wrapper.text()).toContain(enUS.settings.appearance.themeTitle);
    await wrapper.get("select").setValue("zh-CN");
    await flushPromises();
    expect(wrapper.text()).toContain(zhCN.settings.appearance.themeTitle);
    expect(wrapper.text()).toContain(zhCN.settings.appearance.darkDescription);

    await wrapper.get('[data-theme-preference="dark"]').trigger("click");
    expect(setPreference).toHaveBeenCalledWith("dark");
    expect(wrapper.find("script").exists()).toBe(false);
  });
});
