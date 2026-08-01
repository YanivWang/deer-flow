export const SUPPORTED_LOCALES = ["en-US", "zh-CN"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en-US";

export const enUSMessages = {
  common: {
    appName: "DeerFlow",
    releaseBoundary: "Source-backed Vue/Nuxt scaffold; full language-pack replacement is not signed off.",
  },
  settings: {
    appearance: {
      title: "Appearance",
      description: "Theme and language preferences are saved in this browser.",
      themeGroupLabel: "Theme preference",
      localeLabel: "Interface language",
      localeHelp: "Changes update the document language and Ant Design Vue locale.",
      themeSystem: "Follow system",
      themeLight: "Light",
      themeDark: "Dark",
    },
  },
  accessibility: {
    currentSection: "Current settings section",
    selectedTheme: "Selected theme",
  },
} as const;

export type AppI18nMessages = DeepStringRecord<typeof enUSMessages>;

export type I18nMessageKey = DotPath<AppI18nMessages>;

export const zhCNMessages = {
  common: {
    appName: "DeerFlow",
    releaseBoundary: "Vue/Nuxt 脚手架已有源码依据;完整语言包替换尚未签字。",
  },
  settings: {
    appearance: {
      title: "外观",
      description: "主题和语言偏好会保存在当前浏览器本地。",
      themeGroupLabel: "主题偏好",
      localeLabel: "界面语言",
      localeHelp: "切换后会同步文档语言和 Ant Design Vue 语言包。",
      themeSystem: "跟随系统",
      themeLight: "浅色",
      themeDark: "深色",
    },
  },
  accessibility: {
    currentSection: "当前设置分区",
    selectedTheme: "已选择主题",
  },
} satisfies AppI18nMessages;

export const i18nMessages: Record<AppLocale, AppI18nMessages> = {
  "en-US": enUSMessages,
  "zh-CN": zhCNMessages,
};

export function isAppLocale(value: unknown): value is AppLocale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

export function normalizeAppLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE;
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
  if (!message) {
    return key;
  }
  return message.replace(/\{([A-Za-z0-9_]+)\}/g, (placeholder, name: string) => {
    if (Object.prototype.hasOwnProperty.call(values, name)) {
      return String(values[name]);
    }
    return placeholder;
  });
}

export function listI18nMessageKeys(messages: AppI18nMessages): string[] {
  return collectMessageKeys(messages);
}

type DotPath<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : T[Key] extends Record<string, unknown>
      ? `${Key}.${DotPath<T[Key]>}`
      : never;
}[keyof T & string];

type DeepStringRecord<T> = {
  [Key in keyof T]: T[Key] extends string
    ? string
    : T[Key] extends Record<string, unknown>
      ? DeepStringRecord<T[Key]>
      : never;
};

function readMessage(messages: AppI18nMessages, key: string): string | null {
  let current: unknown = messages;
  for (const segment of key.split(".")) {
    if (!isRecord(current) || !(segment in current)) {
      return null;
    }
    current = current[segment];
  }
  return typeof current === "string" ? current : null;
}

function collectMessageKeys(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") {
    return prefix ? [prefix] : [];
  }
  if (!isRecord(value)) {
    return [];
  }
  return Object.keys(value).flatMap((key) => collectMessageKeys(value[key], prefix ? `${prefix}.${key}` : key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
