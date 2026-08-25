import { beforeEach, describe, expect, it } from "vitest";

import {
  buildComposerDraftKey,
  readComposerDraft,
  writeComposerDraft,
} from "@/core/threads/composer-draft";
import { clearComposerDrafts } from "@/core/threads/composer-draft-lifecycle";

describe("composer draft lifecycle", () => {
  beforeEach(() => sessionStorage.clear());

  it("isolates two users, two threads, and agent/non-agent drafts", () => {
    const scopes = [
      { userId: "user-a", threadId: "thread-a", agentName: null },
      { userId: "user-a", threadId: "thread-b", agentName: null },
      { userId: "user-a", threadId: "thread-a", agentName: "analyst" },
      { userId: "user-b", threadId: "thread-a", agentName: null },
    ];

    scopes.forEach((scope, index) => {
      writeComposerDraft(sessionStorage, buildComposerDraftKey(scope), {
        text: `draft-${index}`,
        skillName: null,
      });
    });

    expect(
      scopes.map((scope) =>
        readComposerDraft(sessionStorage, buildComposerDraftKey(scope)),
      ),
    ).toEqual(
      scopes.map((_, index) => ({ text: `draft-${index}`, skillName: null })),
    );
  });

  it("clears only the deleted thread, the logged-out user, or every draft", () => {
    const key = (userId: string, threadId: string, agentName?: string) =>
      buildComposerDraftKey({ userId, threadId, agentName });
    for (const [userId, threadId, agentName] of [
      ["user-a", "thread-a", undefined],
      ["user-a", "thread-b", "analyst"],
      ["user-b", "thread-a", undefined],
    ] as const) {
      writeComposerDraft(sessionStorage, key(userId, threadId, agentName), {
        text: `${userId}/${threadId}`,
        skillName: null,
      });
    }

    clearComposerDrafts(sessionStorage, { threadId: "thread-a" });
    expect(
      readComposerDraft(sessionStorage, key("user-a", "thread-a")),
    ).toBeNull();
    expect(
      readComposerDraft(sessionStorage, key("user-b", "thread-a")),
    ).toBeNull();
    expect(
      readComposerDraft(sessionStorage, key("user-a", "thread-b", "analyst")),
    ).not.toBeNull();

    clearComposerDrafts(sessionStorage, { userId: "user-a" });
    expect(sessionStorage.length).toBe(0);

    writeComposerDraft(sessionStorage, key("user-c", "new"), {
      text: "new draft",
      skillName: null,
    });
    clearComposerDrafts(sessionStorage);
    expect(sessionStorage.length).toBe(0);
  });
});
