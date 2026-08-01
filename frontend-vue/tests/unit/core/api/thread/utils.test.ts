import { describe, expect, it } from "vitest";

import {
  channelSourceOfThread,
  isThreadPinned,
  pathAfterDeletingThread,
  pathOfNewThread,
  pathOfThread,
  shouldResetChatStateForThreadChange,
  sortPinnedThreads,
  THREAD_PINNED_METADATA_KEY,
  titleOfThread,
} from "../../../../../app/core/api/thread/utils";

describe("thread utilities", () => {
  it("builds main and custom-agent chat routes", () => {
    expect(pathOfThread("plain id")).toBe("/workspace/chats/plain%20id");
    expect(
      pathOfThread({
        thread_id: "thread-1",
        context: { agent_name: "research agent" },
      }),
    ).toBe("/workspace/agents/research%20agent/chats/thread-1");
    expect(
      pathOfThread({
        thread_id: "thread/with/slash",
        metadata: { agent_name: "agent/with/slash" },
      }),
    ).toBe("/workspace/agents/agent%2Fwith%2Fslash/chats/thread%2Fwith%2Fslash");
    expect(
      pathOfThread({
        thread_id: "thread-1",
        context: { agent_name: "context agent" },
        metadata: { agent_name: "metadata agent" },
      }),
    ).toBe("/workspace/agents/context%20agent/chats/thread-1");
    expect(pathOfNewThread(() => "fresh id")).toBe("/workspace/chats/fresh%20id");
    expect(pathOfNewThread(() => "fresh id", { agent_name: "research agent" })).toBe(
      "/workspace/agents/research%20agent/chats/fresh%20id",
    );
  });

  it("only redirects to a fresh chat path after deleting the active thread", () => {
    const createThreadId = () => "fresh-thread";

    expect(
      pathAfterDeletingThread({
        createThreadId,
        currentThreadId: "active-thread",
        deletedThreadId: "other-thread",
      }),
    ).toBeNull();
    expect(
      pathAfterDeletingThread({
        context: { agent_name: "research agent" },
        createThreadId,
        currentThreadId: "active-thread",
        deletedThreadId: "active-thread",
      }),
    ).toBe("/workspace/agents/research%20agent/chats/fresh-thread");
  });

  it("resets chat-local state only after moving away from an established thread", () => {
    expect(shouldResetChatStateForThreadChange(undefined, "thread-1")).toBe(false);
    expect(shouldResetChatStateForThreadChange(null, "thread-1")).toBe(false);
    expect(shouldResetChatStateForThreadChange("thread-1", "thread-1")).toBe(false);
    expect(shouldResetChatStateForThreadChange("thread-1", "thread-2")).toBe(true);
    expect(shouldResetChatStateForThreadChange("thread-1", null)).toBe(true);
  });

  it("sorts pinned threads without losing original order inside each group", () => {
    const threads = [
      { thread_id: "a", metadata: {}, values: {} },
      { thread_id: "b", metadata: { [THREAD_PINNED_METADATA_KEY]: true }, values: {} },
      { thread_id: "c", metadata: {}, values: {} },
    ];

    expect(sortPinnedThreads(threads).map((thread) => thread.thread_id)).toEqual(["b", "a", "c"]);
    expect(isThreadPinned(threads[1]!)).toBe(true);
    expect(titleOfThread({ thread_id: "x", values: { title: "Named" } })).toBe("Named");
  });

  it("normalizes IM channel source metadata for sidebar labels", () => {
    expect(
      channelSourceOfThread({
        metadata: { channel_source: { type: "im_channel", provider: " Slack " } },
      }),
    ).toEqual({ type: "im_channel", provider: "slack", label: "Slack" });
    expect(
      channelSourceOfThread({
        metadata: { channel_source: { type: "im_channel", provider: "internal-chat" } },
      })?.label,
    ).toBe("internal-chat");
    expect(channelSourceOfThread({ metadata: { channel_source: { provider: "slack" } } })).toBe(
      null,
    );
  });
});
