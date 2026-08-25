/*
  red/green contract for the workspace-level shell owners.
*/
import { describe, expect, it, vi } from "vitest";

import {
  createWorkspaceToastStore,
  type ToastTimer,
} from "@/core/workspace-shell/toast";
import {
  commandForWorkspaceShortcut,
  isWorkspaceShortcutEditableTarget,
} from "@/core/workspace-shell/shortcuts";
import {
  buildSettingsCloseLocation,
  readSettingsSection,
} from "@/core/workspace-shell/settings-query";
import { createGatewayRecoveryTracker } from "@/core/workspace-shell/gateway-recovery";

describe("workspace toast owner", () => {
  it("announces success/error, dismisses explicitly, and clears timers", () => {
    const scheduled = new Map<number, () => void>();
    const cleared: number[] = [];
    let id = 0;
    const timer: ToastTimer = {
      set(callback) {
        id += 1;
        scheduled.set(id, callback);
        return id;
      },
      clear(timerId) {
        cleared.push(timerId);
        scheduled.delete(timerId);
      },
    };
    const store = createWorkspaceToastStore({ timer, durationMs: 5_000 });

    const successId = store.success("Export complete");
    const errorId = store.error("Clipboard denied");
    expect(
      store.toasts.value.map(({ kind, message }) => [kind, message]),
    ).toEqual([
      ["success", "Export complete"],
      ["error", "Clipboard denied"],
    ]);

    store.dismiss(successId);
    expect(store.toasts.value).toHaveLength(1);
    store.clear();
    expect(store.toasts.value).toEqual([]);
    expect(cleared).toEqual(expect.arrayContaining([1, 2]));
    expect(errorId).toBeGreaterThan(successId);
  });
});

describe("workspace shortcuts", () => {
  it.each([
    [{ key: "k", metaKey: true }, "command-palette"],
    [{ key: "k", ctrlKey: true }, "command-palette"],
    [{ key: "N", metaKey: true, shiftKey: true }, "new-chat"],
    [{ key: "n", ctrlKey: true, shiftKey: true }, "new-chat"],
    [{ key: ",", metaKey: true }, "settings"],
    [{ key: "/", ctrlKey: true }, "shortcuts"],
    [{ key: "b", metaKey: true }, "toggle-sidebar"],
  ] as const)("maps the exact cross-platform command %#", (event, command) => {
    expect(commandForWorkspaceShortcut(event)).toBe(command);
  });

  it("rejects repeats, IME, alt, extra shift, and non-command modifiers", () => {
    expect(
      commandForWorkspaceShortcut({ key: "k", metaKey: true, repeat: true }),
    ).toBeNull();
    expect(
      commandForWorkspaceShortcut({
        key: "k",
        metaKey: true,
        isComposing: true,
      }),
    ).toBeNull();
    expect(
      commandForWorkspaceShortcut({ key: "k", metaKey: true, altKey: true }),
    ).toBeNull();
    expect(
      commandForWorkspaceShortcut({ key: "k", metaKey: true, shiftKey: true }),
    ).toBeNull();
    expect(commandForWorkspaceShortcut({ key: "k" })).toBeNull();
  });

  it("recognizes input, textarea, select and contenteditable targets", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect(
      [input, textarea, select, editable].map(
        isWorkspaceShortcutEditableTarget,
      ),
    ).toEqual([true, true, true, true]);
    expect(isWorkspaceShortcutEditableTarget(document.body)).toBe(false);
  });
});

describe("settings query state machine", () => {
  it("accepts only real settings sections", () => {
    expect(readSettingsSection("memory")).toBe("memory");
    expect(readSettingsSection(["appearance", "memory"])).toBe("appearance");
    expect(readSettingsSection("unknown")).toBeNull();
    expect(readSettingsSection(undefined)).toBeNull();
  });

  it("removes only settings while preserving the rest of query and hash", () => {
    expect(
      buildSettingsCloseLocation({
        path: "/workspace/chats/t-1",
        query: { settings: "memory", tab: "files", tag: ["a", "b"] },
        hash: "#run-2",
      }),
    ).toEqual({
      path: "/workspace/chats/t-1",
      query: { tab: "files", tag: ["a", "b"] },
      hash: "#run-2",
    });
  });
});

describe("Gateway recovery transition", () => {
  it("announces only an unavailable to recovered transition", () => {
    const recovered = vi.fn();
    const tracker = createGatewayRecoveryTracker(recovered);
    tracker.observe("authenticated");
    tracker.observe("unavailable");
    tracker.observe("unavailable");
    tracker.observe("authenticated");
    tracker.observe("authenticated");
    expect(recovered).toHaveBeenCalledTimes(1);
  });
});
