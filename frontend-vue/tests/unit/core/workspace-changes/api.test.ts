/*
  由 scripts/rstest-to-vitest.mjs 从 frontend/tests/unit/core/workspace-changes/api.test.ts 机械生成。
  基线 27a425b0 · 改动仅限 @rstest/core → vitest、rs.* → vi.*。
  勿手改：make codemod-check 会红。需要为 Vue 侧适配就登记进 HAND_MAINTAINED。
*/

import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("fetchWorkspaceChanges can request file metadata without diffs", async () => {
  let requestedUrl = "";
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (typeof input === "string") {
      requestedUrl = input;
    } else if (input instanceof URL) {
      requestedUrl = input.toString();
    } else {
      requestedUrl = input.url;
    }
    return new Response(
      JSON.stringify({
        available: true,
        version: 1,
        summary: {
          created: 1,
          modified: 0,
          deleted: 0,
          additions: 1,
          deletions: 0,
          truncated: false,
        },
        files: [],
        limits: {},
      }),
      { status: 200 },
    );
  });
  vi.stubGlobal("fetch", fetchMock);

  const { fetchWorkspaceChanges } =
    await import("@/core/workspace-changes/api");

  await fetchWorkspaceChanges({
    threadId: "thread-1",
    runId: "run-1",
    includeFiles: true,
    includeDiff: false,
  });

  const url = new URL(requestedUrl, "http://localhost");
  expect(url.searchParams.get("include_files")).toBe("true");
  expect(url.searchParams.get("include_diff")).toBe("false");
});
