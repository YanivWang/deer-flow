/*
  由 scripts/rstest-to-vitest.mjs 从 frontend/tests/unit/core/agents/feature-cache.test.ts 机械生成。
  基线 27a425b0 · 改动仅限 @rstest/core → vitest、rs.* → vi.*。
  勿手改：make codemod-check 会红。需要为 Vue 侧适配就登记进 HAND_MAINTAINED。
*/

import { afterEach, describe, expect, test } from "vitest";

import {
  readCachedAgentsApiEnabled,
  resolveAgentsApiEnabled,
  writeCachedAgentsApiEnabled,
} from "@/core/agents/feature-cache";

describe("resolveAgentsApiEnabled", () => {
  test("a live value always wins over the cache", () => {
    expect(resolveAgentsApiEnabled(true, false)).toBe(true);
    expect(resolveAgentsApiEnabled(false, true)).toBe(false);
  });

  test("falls back to the cached value when live is unknown (sticky)", () => {
    // Disabled stays disabled during an /api/features outage, so the 403
    // storm (#3757) does not come back.
    expect(resolveAgentsApiEnabled(undefined, false)).toBe(false);
    expect(resolveAgentsApiEnabled(undefined, true)).toBe(true);
  });

  test("fails open only when nothing has ever been observed", () => {
    expect(resolveAgentsApiEnabled(undefined, undefined)).toBe(true);
  });
});

describe("agents_api feature cache persistence", () => {
  const store = new Map<string, string>();
  const fakeWindow = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  };

  afterEach(() => {
    store.clear();
    delete (globalThis as { window?: unknown }).window;
  });

  test("round-trips a persisted value", () => {
    (globalThis as { window?: unknown }).window = fakeWindow;
    writeCachedAgentsApiEnabled(false);
    expect(readCachedAgentsApiEnabled()).toBe(false);
    writeCachedAgentsApiEnabled(true);
    expect(readCachedAgentsApiEnabled()).toBe(true);
  });

  test("returns undefined when nothing is stored", () => {
    (globalThis as { window?: unknown }).window = fakeWindow;
    expect(readCachedAgentsApiEnabled()).toBeUndefined();
  });

  test("no-ops without a browser environment (SSR)", () => {
    // window is undefined in the node test environment.
    expect(readCachedAgentsApiEnabled()).toBeUndefined();
    expect(() => writeCachedAgentsApiEnabled(true)).not.toThrow();
  });
});
