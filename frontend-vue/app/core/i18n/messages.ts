import { enUS } from "./locales/en-US";
import { zhCN } from "./locales/zh-CN";
import type { Translations } from "./locales/types";

export const SUPPORTED_LOCALES = ["en-US", "zh-CN"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
type LegacyAppearanceMessages = {
  title: string;
  description: string;
  themeGroupLabel: string;
  localeLabel: string;
  localeHelp: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;
};

type CompatibilityMessages = {
  settings: Translations["settings"] & {
    appearance: Translations["settings"]["appearance"] & LegacyAppearanceMessages;
  };
  threadHistory: {
    streamGapWarning: string;
  };
};

export type AppI18nMessages = Translations & CompatibilityMessages;
export type I18nMessageKey = string;

export const DEFAULT_LOCALE: AppLocale = "en-US";

export const i18nMessages: Record<AppLocale, AppI18nMessages> = {
  "en-US": enrichLocale(enUS, {
    title: "Appearance",
    description: "Theme and language preferences are saved in this browser.",
    themeGroupLabel: "Theme preference",
    localeLabel: "Interface language",
    localeHelp: "Changes update the document language and Ant Design Vue locale.",
    themeSystem: "Follow system",
    themeLight: "Light",
    themeDark: "Dark",
    streamGapWarning: "A stream replay gap was detected; history was reloaded.",
  }),
  "zh-CN": enrichLocale(zhCN, {
    title: "外观",
    description: "主题和语言偏好会保存在当前浏览器本地。",
    themeGroupLabel: "主题偏好",
    localeLabel: "界面语言",
    localeHelp: "切换后会同步文档语言和 Ant Design Vue 语言包。",
    themeSystem: "跟随系统",
    themeLight: "浅色",
    themeDark: "深色",
    streamGapWarning: "检测到流式回放缺口，已重新加载历史。",
  }),
};

export { enUS, zhCN };

export function isAppLocale(value: unknown): value is AppLocale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

export function normalizeAppLocale(value: unknown): AppLocale {
  if (isAppLocale(value)) {
    return value;
  }

  if (typeof value === "string" && value.toLowerCase().startsWith("zh")) {
    return "zh-CN";
  }

  return DEFAULT_LOCALE;
}

export function getHtmlLang(locale: AppLocale): string {
  return locale === "zh-CN" ? "zh-CN" : "en";
}

export function translateI18nMessage(
  key: I18nMessageKey,
  locale: AppLocale,
  values: Readonly<Record<string, string | number>> = {},
): string {
  const message = readMessage(i18nMessages[locale], key) ?? readMessage(i18nMessages[DEFAULT_LOCALE], key);
  if (typeof message === "string") {
    return interpolate(message, values);
  }

  if (typeof message === "function") {
    const argumentsForMessage = Object.values(values);
    return String(message(...argumentsForMessage));
  }

  return key;
}

export function listI18nMessageKeys(messages: AppI18nMessages): string[] {
  return collectMessageKeys(messages);
}

function readMessage(messages: AppI18nMessages, key: string): unknown {
  let current: unknown = messages;
  for (const segment of key.split(".")) {
    if (!isRecord(current) || !(segment in current)) {
      return null;
    }
    current = current[segment];
  }
  return current;
}

function interpolate(message: string, values: Readonly<Record<string, string | number>>): string {
  return message.replace(/\{([A-Za-z0-9_]+)\}/g, (placeholder, name: string) => {
    return Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder;
  });
}

function collectMessageKeys(value: unknown, prefix = ""): string[] {
  if (
    (typeof value === "string" && !prefix.endsWith(".separator")) ||
    (typeof value === "function" && !prefix.endsWith(".icon"))
  ) {
    return prefix ? [prefix] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectMessageKeys(item, `${prefix}[${index}]`));
  }
  if (!isRecord(value)) {
    return [];
  }
  return Object.keys(value).flatMap((key) => collectMessageKeys(value[key], prefix ? `${prefix}.${key}` : key));
}

function enrichLocale(
  locale: Translations,
  compatibility: LegacyAppearanceMessages & { streamGapWarning: string },
): AppI18nMessages {
  return {
    ...locale,
    settings: {
      ...locale.settings,
      appearance: {
        ...locale.settings.appearance,
        ...compatibility,
      },
    },
    threadHistory: {
      streamGapWarning: compatibility.streamGapWarning,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
