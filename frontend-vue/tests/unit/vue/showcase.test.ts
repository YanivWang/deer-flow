import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, test } from "vitest";

import {
  DEMO_THREAD_IDS,
  isDemoThreadId,
  pathOfPublicDemoThread,
  resolveStaticDemoArtifact,
  STATIC_DEMO_ARTIFACTS,
} from "../../../shared/showcase";

const landingSource = readFileSync(
  new URL("../../../app/pages/index.vue", import.meta.url),
  "utf8",
);

function listFiles(root: string, directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? listFiles(root, path)
      : [relative(root, path).replaceAll("\\", "/")];
  });
}

describe("public showcase contracts", () => {
  test("offers one localized primary action into the workspace", () => {
    expect(landingSource).toContain('data-testid="landing-workspace-cta"');
    expect(landingSource).toContain('to="/workspace"');
    expect(landingSource).toContain("marketing.enterWorkspace");
    expect(landingSource).toContain("buttonVariants({ size: 'lg' })");
  });

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

  test("keeps the Vue allowlist in sync with the shared React fixtures", () => {
    const threadsRoot = join(
      import.meta.dirname,
      "../../../../frontend/public/demo/threads",
    );
    const fixtureThreadIds = readdirSync(threadsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect([...DEMO_THREAD_IDS].sort()).toEqual(fixtureThreadIds);
    expect(Object.keys(STATIC_DEMO_ARTIFACTS).sort()).toEqual(fixtureThreadIds);

    for (const fixtureThreadId of fixtureThreadIds) {
      const fixtureFiles = listFiles(join(threadsRoot, fixtureThreadId))
        .filter((path) => path !== "thread.json")
        .sort();
      expect(
        [...(STATIC_DEMO_ARTIFACTS[fixtureThreadId] ?? [])].sort(),
      ).toEqual(fixtureFiles);
    }
  });
});
