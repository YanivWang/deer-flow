/*
  由 scripts/rstest-to-vitest.mjs 从 frontend/tests/unit/core/artifacts/api.test.ts 机械生成。
  基线 27a425b0 · 改动仅限 @rstest/core → vitest、rs.* → vi.*。
  勿手改：make codemod-check 会红。需要为 Vue 侧适配就登记进 HAND_MAINTAINED。
*/

import { afterEach, describe, expect, it, vi } from "vitest";

import { updateArtifactContent } from "@/core/artifacts/api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("updateArtifactContent", () => {
  it("sends the draft and expected revision to the opened artifact URL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          path: "/mnt/user-data/outputs/report.md",
          sha256: "b".repeat(64),
          size: 7,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await updateArtifactContent({
      threadId: "thread-1",
      filepath: "/mnt/user-data/outputs/report.md",
      content: "updated",
      expectedSha256: "a".repeat(64),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(typeof url).toBe("string");
    expect(url as string).toContain(
      "/api/threads/thread-1/artifacts/mnt/user-data/outputs/report.md",
    );
    expect(init?.method).toBe("PUT");
    expect(typeof init?.body).toBe("string");
    expect(JSON.parse(init?.body as string)).toEqual({
      content: "updated",
      expected_sha256: "a".repeat(64),
    });
  });

  it("preserves the response status for conflict handling", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Artifact changed" }), {
        status: 412,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      updateArtifactContent({
        threadId: "thread-1",
        filepath: "/mnt/user-data/outputs/report.md",
        content: "updated",
        expectedSha256: "a".repeat(64),
      }),
    ).rejects.toMatchObject({ status: 412 });
  });
});
