import { describe, expect, it, vi } from "vitest";

import {
  buildVisibleHistoryMessages,
  clearThreadGoal,
  compactThreadContext,
  createThread,
  fetchThreadMessagesPage,
  flattenThreadHistoryPages,
  getThreadGoal,
  getThreadHistoryNextPageParam,
  parseThreadMessagesPageResponse,
  reconcileThreadHistoryRows,
  renameThread,
  searchThreads,
  setThreadGoal,
} from "../../../../../app/core/api/thread/client";
import type { RunMessage } from "../../../../../app/core/api/thread/types";

describe("thread API client", () => {
  it("searches Gateway thread metadata through the REST endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json([
        {
          thread_id: "thread-1",
          status: "idle",
          created_at: "2026-07-31T00:00:00Z",
          updated_at: "2026-07-31T00:00:00Z",
          metadata: {},
          values: { title: "Hello" },
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const threads = await searchThreads({ limit: 10, offset: 5 });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/langgraph/threads/search",
      expect.objectContaining({
        body: JSON.stringify({ metadata: {}, limit: 10, offset: 5 }),
        credentials: "include",
        method: "POST",
      }),
    );
    expect(threads[0]?.values.title).toBe("Hello");
  });

  it("adds the CSRF cookie to state-changing requests", async () => {
    vi.stubGlobal("document", { cookie: "csrf_token=token-1" });
    const fetchMock = vi.fn(async () => Response.json({ values: { title: "Renamed" } }));
    vi.stubGlobal("fetch", fetchMock);

    await renameThread("thread-1", "Renamed");

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/langgraph/threads/thread-1/state",
      expect.objectContaining({ method: "POST" }),
    );
    expect(headers.get("X-CSRF-Token")).toBe("token-1");
  });

  it("creates Gateway threads with caller metadata", async () => {
    vi.stubGlobal("document", { cookie: "csrf_token=thread-token" });
    const fetchMock = vi.fn(async () =>
      Response.json({
        thread_id: "thread-1",
        status: "idle",
        created_at: "2026-07-31T00:00:00Z",
        updated_at: "2026-07-31T00:00:00Z",
        metadata: { agent_name: "researcher" },
        values: {},
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const created = await createThread({
      metadata: { agent_name: "researcher" },
      threadId: "thread-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/langgraph/threads",
      expect.objectContaining({
        body: JSON.stringify({
          thread_id: "thread-1",
          metadata: { agent_name: "researcher" },
        }),
        credentials: "include",
        method: "POST",
      }),
    );
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("X-CSRF-Token")).toBe(
      "thread-token",
    );
    expect(created.thread_id).toBe("thread-1");
    expect(created.metadata?.agent_name).toBe("researcher");
  });

  it("surfaces backend detail for rename conflicts", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ detail: "Thread has an active run." }, { status: 409 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(renameThread("thread-1", "Blocked title")).rejects.toThrow(
      "Thread has an active run.",
    );
  });

  it("falls back to a stable error when the backend returns non-JSON or empty detail", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(new Response("not json", { status: 500 }))
      .mockResolvedValueOnce(Response.json({ detail: "" }, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(renameThread("thread-1", "Title")).rejects.toThrow("对话请求失败。");
    await expect(renameThread("thread-1", "Title")).rejects.toThrow("对话请求失败。");
  });

  it("formats array and object detail envelopes from FastAPI-style errors", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(
        Response.json(
          {
            detail: [
              { msg: "Title is too long." },
              { message: "Thread metadata is invalid." },
            ],
          },
          { status: 422 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({ detail: { error: "Thread state is locked." } }, { status: 409 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(renameThread("thread-1", "Title")).rejects.toThrow(
      "Title is too long.\nThread metadata is invalid.",
    );
    await expect(renameThread("thread-1", "Title")).rejects.toThrow("Thread state is locked.");
  });

  it("reads, sets, and clears thread goals through the Gateway goal endpoint", async () => {
    vi.stubGlobal("document", { cookie: "csrf_token=token-1" });
    const activeGoal = goal("Ship Vue parity");
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ goal: activeGoal }))
      .mockResolvedValueOnce(Response.json({ goal: activeGoal }))
      .mockResolvedValueOnce(Response.json({ goal: null }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getThreadGoal("thread-1")).resolves.toEqual(activeGoal);
    await expect(setThreadGoal("thread-1", { objective: "Ship Vue parity" })).resolves.toEqual(
      activeGoal,
    );
    await expect(clearThreadGoal("thread-1")).resolves.toBeNull();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/threads/thread-1/goal");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ method: "GET" }));
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/threads/thread-1/goal");
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ objective: "Ship Vue parity" }),
        method: "PUT",
      }),
    );
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("X-CSRF-Token")).toBe(
      "token-1",
    );
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({ method: "DELETE" }));
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("X-CSRF-Token")).toBe(
      "token-1",
    );
  });

  it("compacts thread context through the Gateway compact endpoint", async () => {
    vi.stubGlobal("document", { cookie: "csrf_token=token-1" });
    const compactResponse = {
      thread_id: "thread-1",
      compacted: true,
      reason: null,
      removed_message_count: 12,
      preserved_message_count: 4,
      summary_updated: true,
      checkpoint_id: "checkpoint-1",
      total_tokens: 1024,
    };
    const fetchMock = vi.fn(async () => Response.json(compactResponse));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      compactThreadContext("thread-1", {
        agentName: "researcher",
        modelName: "model-a",
      }),
    ).resolves.toEqual(compactResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/threads/thread-1/compact",
      expect.objectContaining({
        body: JSON.stringify({
          force: true,
          agent_name: "researcher",
          model_name: "model-a",
        }),
        method: "POST",
      }),
    );
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe("token-1");
  });

  it("loads and flattens backward history pages by seq", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [
          {
            run_id: "run-2",
            seq: 2,
            content: { id: "a-1", type: "ai", content: "hello" },
            metadata: {},
            created_at: "2026-07-31T00:00:01Z",
          },
        ],
        has_more: true,
        next_before_seq: 2,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await fetchThreadMessagesPage("thread-1", 3);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/threads/thread-1/messages/page?before_seq=3",
      expect.objectContaining({ method: "GET" }),
    );
    expect(getThreadHistoryNextPageParam(page)).toBe(2);
    expect(flattenThreadHistoryPages([page])).toEqual(page.data);
  });

  it("rejects malformed history pages before the UI can merge them", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [{ seq: "bad" }],
        has_more: true,
        next_before_seq: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchThreadMessagesPage("thread-1")).rejects.toThrow(
      "对话历史返回了无效消息行。",
    );
  });

  it("rejects duplicate seq values and invalid terminal cursors in history pages", () => {
    expect(() =>
      parseThreadMessagesPageResponse({
        data: [runMessage(1, "run-1", "a"), runMessage(1, "run-1", "b")],
        has_more: false,
        next_before_seq: null,
      }),
    ).toThrow("对话历史返回了重复的 seq 值。");

    expect(() =>
      parseThreadMessagesPageResponse({
        data: [runMessage(1, "run-1", "a")],
        has_more: false,
        next_before_seq: 1,
      }),
    ).toThrow("对话历史返回了无效的 next_before_seq 游标。");
  });

  it("dedupes history snapshots by run and message identity without moving canonical order", () => {
    const rows = flattenThreadHistoryPages([
      {
        data: [runMessage(3, "run-1", "a", "new")],
        has_more: true,
        next_before_seq: 3,
      },
      {
        data: [runMessage(1, "run-1", "h"), runMessage(2, "run-1", "a", "old")],
        has_more: false,
        next_before_seq: null,
      },
    ]);

    expect(rows.map((row) => [row.seq, row.content.id, row.content.content])).toEqual([
      [1, "h", "h"],
      [3, "a", "new"],
    ]);
  });

  it("retains previously loaded history while an incomplete refetch shifts the first page", () => {
    const previousRows = [
      runMessage(1, "run-1", "h-1"),
      runMessage(2, "run-1", "a-1"),
      runMessage(3, "run-2", "h-2"),
    ];
    const currentRows = [runMessage(4, "run-2", "a-2")];

    expect(reconcileThreadHistoryRows(previousRows, currentRows, false).map((row) => row.seq)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(reconcileThreadHistoryRows(previousRows, currentRows, true).map((row) => row.seq)).toEqual([
      4,
    ]);
  });

  it("projects history messages with their owning run id and hides superseded runs", () => {
    const messages = buildVisibleHistoryMessages(
      [
        runMessage(1, "run-1", "h-1"),
        runMessage(2, "run-2", "a-1", "old"),
        runMessage(3, "run-2", "a-1", "new"),
      ],
      new Set(["run-1"]),
    );

    expect(messages?.map((message) => [message.id, message.content, message.run_id])).toEqual([
      ["a-1", "new", "run-2"],
    ]);
  });
});

function runMessage(seq: number, runId: string, id: string, content = id): RunMessage {
  return {
    run_id: runId,
    seq,
    content: { id, type: id.startsWith("h") ? "human" : "ai", content },
    metadata: {},
    created_at: "2026-07-31T00:00:00Z",
  };
}

function goal(objective: string) {
  return {
    objective,
    status: "active" as const,
    created_at: "2026-07-31T00:00:00Z",
    updated_at: "2026-07-31T00:00:00Z",
    continuation_count: 0,
    max_continuations: 8,
    no_progress_count: 0,
    max_no_progress_continuations: 2,
  };
}
