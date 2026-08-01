import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from "../i18n";

export type ThemePreference = "system" | "light" | "dark";
export type LocalePreference = AppLocale;

export type WorkspacePreferences = {
  appearance: {
    theme: ThemePreference;
    locale: LocalePreference;
  };
  notification: {
    enabled: boolean;
  };
};

export type WorkspacePreferencesStorage = Pick<Storage, "getItem" | "setItem">;

export const WORKSPACE_PREFERENCES_KEY = "deerflow.vue.workspace-preferences";

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  appearance: {
    theme: "system",
    locale: DEFAULT_LOCALE,
  },
  notification: {
    enabled: true,
  },
};

export function readWorkspacePreferences(
  storage: WorkspacePreferencesStorage | null = readBrowserStorage(),
): WorkspacePreferences {
  const raw = safeGet(storage, WORKSPACE_PREFERENCES_KEY);
  if (!raw) {
    return DEFAULT_WORKSPACE_PREFERENCES;
  }

  try {
    return mergeWorkspacePreferences(JSON.parse(raw) as Partial<WorkspacePreferences>);
  } catch {
    return DEFAULT_WORKSPACE_PREFERENCES;
  }
}

export function writeWorkspacePreferences(
  preferences: WorkspacePreferences,
  storage: WorkspacePreferencesStorage | null = readBrowserStorage(),
): boolean {
  return safeSet(
    storage,
    WORKSPACE_PREFERENCES_KEY,
    JSON.stringify(mergeWorkspacePreferences(preferences)),
  );
}

export function mergeWorkspacePreferences(
  preferences?: Partial<WorkspacePreferences>,
): WorkspacePreferences {
  const appearance = preferences?.appearance;
  const notification = preferences?.notification;
  return {
    appearance: {
      theme: isThemePreference(appearance?.theme)
        ? appearance.theme
        : DEFAULT_WORKSPACE_PREFERENCES.appearance.theme,
      locale: isLocalePreference(appearance?.locale)
        ? appearance.locale
        : DEFAULT_WORKSPACE_PREFERENCES.appearance.locale,
    },
    notification: {
      enabled:
        typeof notification?.enabled === "boolean"
          ? notification.enabled
          : DEFAULT_WORKSPACE_PREFERENCES.notification.enabled,
    },
  };
}

export function applyThemePreference(
  theme: ThemePreference,
  root: Pick<HTMLElement, "dataset"> | null = readDocumentElement(),
  prefersDark = readSystemDarkPreference(),
): "light" | "dark" {
  const resolved = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
  if (root) {
    root.dataset.theme = resolved;
  }
  return resolved;
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

const isLocalePreference = isAppLocale;

function readBrowserStorage(): WorkspacePreferencesStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function readDocumentElement(): Pick<HTMLElement, "dataset"> | null {
  if (typeof document === "undefined") {
    return null;
  }
  return document.documentElement;
}

function readSystemDarkPreference(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function safeGet(storage: WorkspacePreferencesStorage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(
  storage: WorkspacePreferencesStorage | null,
  key: string,
  value: string,
): boolean {
  try {
    storage?.setItem(key, value);
    return Boolean(storage);
  } catch {
    return false;
  }
}
