import { describe, expect, it, vi } from "vitest";

import {
  LOCAL_SETTINGS_KEY,
  readLocalSettings,
  readThreadModelName,
  sanitizeContext,
  threadModelStorageKey,
  writeLocalSettings,
  writeThreadModelName,
} from "../../../../app/core/settings/local";

describe("local settings storage", () => {
  it("sanitizes context fields persisted in local settings", () => {
    expect(
      sanitizeContext({
        agent_name: " researcher ",
        model_name: " model-a ",
        thinking_enabled: true,
        subagent_enabled: false,
        reasoning_effort: "high",
        mode: "ultra",
        user_id: "client-owned",
      }),
    ).toEqual({
      agent_name: "researcher",
      model_name: "model-a",
      thinking_enabled: true,
      subagent_enabled: false,
      reasoning_effort: "high",
      mode: "ultra",
    });
  });

  it("reads and writes local settings with storage error fallback", () => {
    const storage = memoryStorage();

    expect(writeLocalSettings({ context: { model_name: "model-a" } }, storage)).toBe(true);
    expect(JSON.parse(storage.getItem(LOCAL_SETTINGS_KEY) ?? "{}")).toEqual({
      context: { model_name: "model-a" },
    });
    expect(readLocalSettings(storage).context.model_name).toBe("model-a");

    const brokenStorage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    expect(readLocalSettings(brokenStorage).context).toEqual({});
  });

  it("persists thread-specific model overrides separately", () => {
    const storage = memoryStorage();

    writeThreadModelName("thread-a", "model-a", storage);
    expect(readThreadModelName("thread-a", storage)).toBe("model-a");
    expect(storage.getItem(threadModelStorageKey("thread-a"))).toBe("model-a");

    writeThreadModelName("thread-a", undefined, storage);
    expect(readThreadModelName("thread-a", storage)).toBeUndefined();
  });
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
