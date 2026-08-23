/* WP-11 red/green contract for the Workspace Changes server-state owner. */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchWorkspaceChanges } from "@/core/workspace-changes/api";
import { workspaceChangesKeys } from "@/core/workspace-changes/query-keys";
import {
  workspaceChangeReasonKey,
  workspaceChangeStatusKey,
} from "@/core/workspace-changes/presentation";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("workspace changes query contract", () => {
  it("separates summary/detail and thread/run keys", () => {
    expect(workspaceChangesKeys.request("t-1", "r-1", true, false)).not.toEqual(
      workspaceChangesKeys.request("t-1", "r-1", true, true),
    );
    expect(workspaceChangesKeys.request("t-1", "r-1", true, true)).not.toEqual(
      workspaceChangesKeys.request("t-2", "r-1", true, true),
    );
  });

  it("passes AbortSignal and preserves real Gateway detail/status", async () => {
    const controller = new AbortController();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "workspace snapshot expired" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    );
    const request = fetchWorkspaceChanges({
      threadId: "t-1",
      runId: "r-1",
      includeFiles: true,
      includeDiff: true,
      signal: controller.signal,
    });
    await expect(request).rejects.toMatchObject({
      message: "workspace snapshot expired",
      status: 409,
    });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      signal: controller.signal,
    });
  });
});

describe("workspace changes presentation", () => {
  it.each([
    ["created", "created"],
    ["modified", "modified"],
    ["deleted", "deleted"],
    ["symlink_created", "symlinkCreated"],
  ] as const)("maps status %s without collapsing it", (status, key) => {
    expect(workspaceChangeStatusKey(status)).toBe(key);
  });

  it.each([
    ["binary", "binaryUnavailable"],
    ["large", "largeUnavailable"],
    ["sensitive", "sensitiveUnavailable"],
    ["truncated", "truncatedUnavailable"],
    ["symlink", "symlinkUnavailable"],
    [null, "diffUnavailable"],
  ] as const)(
    "maps diff reason %s to its exact user-visible key",
    (reason, key) => {
      expect(workspaceChangeReasonKey(reason)).toBe(key);
    },
  );
});
