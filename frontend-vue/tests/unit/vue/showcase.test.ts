import { describe, expect, test } from "vitest";

import {
  DEMO_THREAD_IDS,
  isDemoThreadId,
  pathOfPublicDemoThread,
  resolveStaticDemoArtifact,
} from "../../../shared/showcase";

describe("public showcase contracts", () => {
  test("keeps the public demo allowlist and route stable", () => {
    expect(DEMO_THREAD_IDS).toHaveLength(13);
    expect(isDemoThreadId(DEMO_THREAD_IDS[0]!)).toBe(true);
    expect(isDemoThreadId("unknown-thread")).toBe(false);
    expect(pathOfPublicDemoThread(DEMO_THREAD_IDS[0]!)).toBe(
      `/showcase/${DEMO_THREAD_IDS[0]}`,
    );
  });

  test("resolves only allowlisted artifact paths", () => {
    const threadId = "21cfea46-34bd-4aa6-9e1f-3009452fbeb9";
    expect(
      resolveStaticDemoArtifact(threadId, [
        "mnt",
        "user-data",
        "outputs",
        "doraemon-moe-comic.jpg",
      ]),
    ).toBe(
      `/demo/threads/${threadId}/user-data/outputs/doraemon-moe-comic.jpg`,
    );
    expect(
      resolveStaticDemoArtifact(threadId, ["mnt", "..", "secret"]),
    ).toBeNull();
    expect(
      resolveStaticDemoArtifact(threadId, ["mnt", "unknown.jpg"]),
    ).toBeNull();
  });
});
