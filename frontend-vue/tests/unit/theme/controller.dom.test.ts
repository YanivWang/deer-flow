/*
  【文件职责】     固定唯一 theme owner、system media 生命周期与首屏初始化合同。
  【架构位置】     Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     app/core/theme/controller.ts · bootstrap.ts
  【边界与注意】   设置组件不得拥有 matchMedia/localStorage/class 生命周期。
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createThemeController,
  THEME_STORAGE_KEY,
} from "@/core/theme/controller";
import { createThemeBootstrapScript } from "@/core/theme/bootstrap";

type ChangeListener = (event: MediaQueryListEvent) => void;

function mediaQuery(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<ChangeListener>();
  const media = {
    media: "(prefers-color-scheme: dark)",
    get matches() {
      return matches;
    },
    addEventListener: vi.fn((_type: string, listener: ChangeListener) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: ChangeListener) => {
      listeners.delete(listener);
    }),
    dispatch(next: boolean) {
      matches = next;
      for (const listener of listeners) {
        listener({ matches: next } as MediaQueryListEvent);
      }
    },
    listenerCount() {
      return listeners.size;
    },
  };
  return media;
}

beforeEach(() => {
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
  localStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe("createThemeController", () => {
  it("applies the initial system light/dark value and follows later changes", () => {
    const media = mediaQuery(false);
    const controller = createThemeController({
      root: document.documentElement,
      media: media as unknown as MediaQueryList,
      storage: localStorage,
    });
    expect(controller.preference.value).toBe("system");
    expect(controller.resolved.value).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(media.addEventListener).toHaveBeenCalledTimes(1);

    media.dispatch(true);
    expect(controller.resolved.value).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    media.dispatch(false);
    expect(controller.resolved.value).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("keeps explicit themes stable and resynchronizes immediately when returning to system", () => {
    const media = mediaQuery(false);
    const controller = createThemeController({
      root: document.documentElement,
      media: media as unknown as MediaQueryList,
      storage: localStorage,
    });
    controller.setPreference("dark");
    media.dispatch(false);
    expect(controller.resolved.value).toBe("dark");
    controller.setPreference("light");
    media.dispatch(true);
    expect(controller.resolved.value).toBe("light");

    controller.setPreference("system");
    expect(controller.resolved.value).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });

  it("keeps the React root-route forced dark override separate from the stored preference", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    const media = mediaQuery(false);
    const controller = createThemeController({
      root: document.documentElement,
      media: media as unknown as MediaQueryList,
      storage: localStorage,
      forced: "dark",
    });
    expect(controller.preference.value).toBe("light");
    expect(controller.resolved.value).toBe("dark");
    controller.setPreference("system");
    media.dispatch(false);
    expect(controller.resolved.value).toBe("dark");
    controller.setForcedTheme(null);
    expect(controller.resolved.value).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });

  it("registers one listener, disposes it once, and ignores late media events", () => {
    const media = mediaQuery(false);
    const controller = createThemeController({
      root: document.documentElement,
      media: media as unknown as MediaQueryList,
      storage: localStorage,
    });
    expect(media.listenerCount()).toBe(1);
    controller.dispose();
    controller.dispose();
    expect(media.removeEventListener).toHaveBeenCalledTimes(1);
    expect(media.listenerCount()).toBe(0);
    media.dispatch(true);
    expect(controller.resolved.value).toBe("light");
  });

  it("falls back safely from invalid storage and normalizes the persisted value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    const media = mediaQuery(true);
    const controller = createThemeController({
      root: document.documentElement,
      media: media as unknown as MediaQueryList,
      storage: localStorage,
    });
    expect(controller.preference.value).toBe("system");
    expect(controller.resolved.value).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });
});

describe("theme bootstrap", () => {
  it("sets the same class before component mount without a second lifecycle owner", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    const matchMedia = vi.fn(() => mediaQuery(false));
    vi.stubGlobal("matchMedia", matchMedia);
    Function(createThemeBootstrapScript())();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(matchMedia).not.toHaveBeenCalled();
  });
});
