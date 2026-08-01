import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  i18nMessages,
  isAppLocale,
  listI18nMessageKeys,
  normalizeAppLocale,
  translateI18nMessage,
  type I18nMessageKey,
} from "../../../../app/core/i18n";

describe("Vue i18n message scaffold", () => {
  it("keeps locale support explicit and sanitized", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en-US", "zh-CN"]);
    expect(DEFAULT_LOCALE).toBe("en-US");
    expect(isAppLocale("zh-CN")).toBe(true);
    expect(isAppLocale("fr-FR")).toBe(false);
    expect(normalizeAppLocale("zh-CN")).toBe("zh-CN");
    expect(normalizeAppLocale("fr-FR")).toBe(DEFAULT_LOCALE);
  });

  it("keeps every locale on the same non-empty message keys", () => {
    const defaultKeys = [...listI18nMessageKeys(i18nMessages[DEFAULT_LOCALE])].sort();
    expect(defaultKeys.length).toBeGreaterThan(0);

    for (const locale of SUPPORTED_LOCALES) {
      const keys = [...listI18nMessageKeys(i18nMessages[locale])].sort();
      expect(keys).toEqual(defaultKeys);
      for (const key of keys) {
        expect(translateI18nMessage(key as I18nMessageKey, locale).trim()).not.toBe("");
      }
    }
  });

  it("translates typed keys without replacing current page copy yet", () => {
    expect(translateI18nMessage("settings.appearance.title", "zh-CN")).toBe("外观");
    expect(translateI18nMessage("settings.appearance.title", "en-US")).toBe("Appearance");
  });
});
