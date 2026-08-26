/* red/green contract for thread share/export and updated time. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadAsFile } from "@/core/threads/export";
import {
  buildThreadShareUrl,
  loadThreadExportMessages,
} from "@/core/threads/thread-actions";
import { formatThreadUpdatedTime } from "@/core/threads/updated-time";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("thread share", () => {
  it("copies the stable thread path on production origins", () => {
    expect(
      buildThreadShareUrl(
        {
          thread_id: "thread / 1",
          metadata: {},
        },
        "https://deer.example",
      ),
    ).toBe("https://deer.example/workspace/chats/thread%20%2F%201");
  });

  it("uses the public React-equivalent origin on loopback", () => {
    expect(
      buildThreadShareUrl(
        { thread_id: "agent-thread", metadata: { agent_name: "researcher" } },
        "http://127.0.0.1:3100",
      ),
    ).toBe(
      "https://deer-flow-v2.vercel.app/workspace/agents/researcher/chats/agent-thread",
    );
  });
});

describe("thread export", () => {
  it("loads messages from the real thread-state client and rejects empty state", async () => {
    const getState = vi.fn().mockResolvedValue({
      values: { messages: [{ id: "m-1", type: "human", content: "hello" }] },
    });
    await expect(
      loadThreadExportMessages({ threads: { getState } }, "t-1"),
    ).resolves.toHaveLength(1);
    getState.mockResolvedValueOnce({ values: { messages: [] } });
    await expect(
      loadThreadExportMessages({ threads: { getState } }, "t-1"),
    ).rejects.toThrow("no messages");
  });

  it("always removes the anchor and revokes the object URL when click throws", () => {
    const revoke = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:wp11"),
      revokeObjectURL: revoke,
    });
    const nativeCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((
      tagName: string,
    ) => {
      const element = nativeCreate(tagName);
      if (tagName === "a")
        vi.spyOn(element, "click").mockImplementation(() => {
          throw new Error("download blocked");
        });
      return element;
    }) as typeof document.createElement);

    expect(() =>
      downloadAsFile("hello", "thread.md", "text/markdown;charset=utf-8"),
    ).toThrow("download blocked");
    expect(document.querySelector('a[download="thread.md"]')).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:wp11");
  });
});

/*
  措辞逐字钉住 React 的 formatTimeAgo：两个应用用同一个 date-fns，所以「about 1 year
  ago」这类带 about 的分桶也必须一模一样。这里刻意同时钉 5 分钟（无 about）和 1 年
  （有 about）两档——只钉分钟档的话，换成自己分桶的实现也能通过，而那正是这次修掉的
  那个 bug。
*/
describe("updated_at presentation", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats an ISO timestamp using timezone-safe elapsed time", () => {
    expect(formatThreadUpdatedTime("2026-08-23T11:55:00.000Z", "en-US")).toBe(
      "5 minutes ago",
    );
  });

  it("keeps date-fns' approximate wording for the coarse buckets", () => {
    expect(formatThreadUpdatedTime("2025-06-30T12:00:00.000Z", "en-US")).toBe(
      "about 1 year ago",
    );
    expect(formatThreadUpdatedTime("2025-06-30T12:00:00.000Z", "zh-CN")).toBe(
      "大约 1 年前",
    );
  });

  it("returns null for a missing timestamp and a dash for an invalid one", () => {
    expect(formatThreadUpdatedTime(undefined, "en-US")).toBeNull();
    expect(formatThreadUpdatedTime("", "en-US")).toBeNull();
    expect(formatThreadUpdatedTime("not-a-date", "en-US")).toBe("-");
  });
});
