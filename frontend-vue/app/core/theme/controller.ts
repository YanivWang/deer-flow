/*
  【文件职责】     独占 system/light/dark、media listener、storage 与 html class 生命周期。
  【对应 frontend/】 components/theme-provider.tsx + next-themes
  【架构位置】     L3
  【主要导出】     createThemeController · ThemeController
  【依赖关系】     Vue refs · theme/bootstrap.ts
  【边界与注意】   每个应用只能创建一个实例；页面和设置组件只消费 preference/resolved/setPreference。
*/

import { readonly, ref, type DeepReadonly, type Ref } from "vue";

import {
  isThemePreference,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "./bootstrap";

export { THEME_STORAGE_KEY } from "./bootstrap";
export type { ResolvedTheme, ThemePreference } from "./bootstrap";

interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ThemeController {
  preference: DeepReadonly<Ref<ThemePreference>>;
  resolved: DeepReadonly<Ref<ResolvedTheme>>;
  forced: DeepReadonly<Ref<ResolvedTheme | null>>;
  setPreference(preference: ThemePreference): void;
  setForcedTheme(theme: ResolvedTheme | null): void;
  dispose(): void;
}

export interface ThemeControllerOptions {
  root: HTMLElement;
  media: MediaQueryList;
  storage: ThemeStorage;
  forced?: ResolvedTheme | null;
}

function storedPreference(storage: ThemeStorage): ThemePreference {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
    storage.setItem(THEME_STORAGE_KEY, "system");
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
  return "system";
}

function persistPreference(storage: ThemeStorage, value: ThemePreference) {
  try {
    storage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // Theme state remains usable for the current page when persistence fails.
  }
}

export function createThemeController({
  root,
  media,
  storage,
  forced: initialForced = null,
}: ThemeControllerOptions): ThemeController {
  const preference = ref<ThemePreference>(storedPreference(storage));
  const resolved = ref<ResolvedTheme>("light");
  const forced = ref<ResolvedTheme | null>(initialForced);
  let disposed = false;

  const apply = () => {
    const next: ResolvedTheme =
      forced.value ??
      (preference.value === "dark" ||
      (preference.value === "system" && media.matches)
        ? "dark"
        : "light");
    resolved.value = next;
    root.classList.toggle("dark", next === "dark");
    root.style.colorScheme = next;
  };

  const onMediaChange = () => {
    if (!disposed && !forced.value && preference.value === "system") apply();
  };
  media.addEventListener("change", onMediaChange);
  apply();

  return {
    preference: readonly(preference),
    resolved: readonly(resolved),
    forced: readonly(forced),
    setPreference(next) {
      if (disposed || next === preference.value) {
        if (!disposed && next === "system") apply();
        return;
      }
      preference.value = next;
      persistPreference(storage, next);
      apply();
    },
    setForcedTheme(next) {
      if (disposed || next === forced.value) return;
      forced.value = next;
      apply();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      media.removeEventListener("change", onMediaChange);
    },
  };
}
