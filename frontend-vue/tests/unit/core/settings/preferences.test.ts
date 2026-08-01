import { describe, expect, it, vi } from "vitest";

import {
  applyThemePreference,
  readWorkspacePreferences,
  WORKSPACE_PREFERENCES_KEY,
  writeWorkspacePreferences,
} from "../../../../app/core/settings/preferences";

describe("workspace settings preferences", () => {
  it("reads, sanitizes, and writes appearance preferences", () => {
    const storage = memoryStorage();
    storage.setItem(
      WORKSPACE_PREFERENCES_KEY,
      JSON.stringify({
        appearance: {
          theme: "dark",
          locale: "zh-CN",
          injected: true,
        },
        notification: {
          enabled: false,
          injected: true,
        },
      }),
    );

    expect(readWorkspacePreferences(storage)).toEqual({
      appearance: { locale: "zh-CN", theme: "dark" },
      notification: { enabled: false },
    });

    expect(
      writeWorkspacePreferences(
        {
          appearance: { locale: "en-US", theme: "system" },
          notification: { enabled: true },
        },
        storage,
      ),
    ).toBe(true);
    expect(JSON.parse(storage.getItem(WORKSPACE_PREFERENCES_KEY) ?? "{}")).toEqual({
      appearance: { locale: "en-US", theme: "system" },
      notification: { enabled: true },
    });
  });

  it("falls back to defaults when storage throws or contains invalid JSON", () => {
    const brokenStorage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(),
    };

    expect(readWorkspacePreferences(brokenStorage).appearance.theme).toBe("system");

    const storage = memoryStorage();
    storage.setItem(WORKSPACE_PREFERENCES_KEY, "{broken");
    expect(readWorkspacePreferences(storage).appearance.locale).toBe("en-US");
  });

  it("applies explicit and system theme preferences to the document root", () => {
    const root = { dataset: {} as DOMStringMap };

    expect(applyThemePreference("dark", root, false)).toBe("dark");
    expect(root.dataset.theme).toBe("dark");

    expect(applyThemePreference("system", root, true)).toBe("dark");
    expect(applyThemePreference("system", root, false)).toBe("light");
  });
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
