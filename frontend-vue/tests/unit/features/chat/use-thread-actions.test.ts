import { computed, ref } from "vue";

import { useThreadActions } from "../../../../app/features/chat/thread-actions/use-thread-actions";

function createActions(overrides: Partial<Parameters<typeof useThreadActions>[0]> = {}) {
  const options: Parameters<typeof useThreadActions>[0] = {
    activeThreadPinned: computed(() => false),
    agentName: computed(() => "lead_agent"),
    createThread: vi.fn(async () => ({ thread_id: "created-thread" })),
    deleteThread: vi.fn(async () => undefined),
    draft: ref(""),
    isBusy: computed(() => false),
    onBrowserClose: vi.fn(),
    onNewChatStateReset: vi.fn(),
    pathOfNewThread: vi.fn(() => "/workspace/chats/new"),
    pathOfThread: vi.fn((threadId: string) => `/workspace/chats/${threadId}`),
    pinThread: vi.fn(async () => undefined),
    refetchHistory: vi.fn(async () => undefined),
    refetchThreads: vi.fn(async () => undefined),
    renameThread: vi.fn(async () => undefined),
    replaceRoute: vi.fn(async () => undefined),
    resetSidecar: vi.fn(),
    resetStream: vi.fn(),
    sendMessage: vi.fn(async () => undefined),
    setHistoryMessages: vi.fn(),
    stop: vi.fn(async () => undefined),
    threadId: ref("thread-1"),
    threadRunContext: computed(() => ({ agent_name: "lead_agent" })),
    ...overrides,
  };
  return { actions: useThreadActions(options), options };
}

describe("useThreadActions", () => {
  it("creates and navigates to a thread through the thread-list contract", async () => {
    const { actions, options } = createActions();

    await actions.createNewThread();

    expect(options.createThread).toHaveBeenCalledWith({
      agentName: "lead_agent",
      threadId: expect.stringMatching(/^[0-9a-f-]+$/),
    });
    expect(options.pathOfThread).toHaveBeenCalledWith("created-thread", { agent_name: "lead_agent" });
    expect(options.replaceRoute).toHaveBeenCalledWith("/workspace/chats/created-thread");
  });

  it("keeps rename normalization and mutation errors in the owner state", async () => {
    const renameThread = vi.fn().mockRejectedValue(new Error("rename failed"));
    const { actions, options } = createActions({ renameThread });
    actions.renameDraft.value = "  New title  ";

    await actions.renameActiveThread();

    expect(renameThread).toHaveBeenCalledWith({ threadId: "thread-1", title: "New title" });
    expect(actions.renameErrorMessage.value).toBe("rename failed");
    expect(options.refetchThreads).not.toHaveBeenCalled();
  });

  it("preserves authenticated regenerate preparation and replay metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      checkpoint: { id: "checkpoint-1" },
      input: { messages: [{ content: "prepared" }] },
      metadata: { source: "regenerate" },
    }), { status: 200 })));
    const { actions, options } = createActions();

    await actions.regenerateMessage({ id: "message-1" });

    expect(fetch).toHaveBeenCalledWith(
      "/api/threads/thread-1/runs/regenerate/prepare",
      expect.objectContaining({ credentials: "include", method: "POST" }),
    );
    expect(options.sendMessage).toHaveBeenCalledWith({
      checkpoint: { id: "checkpoint-1" },
      context: { agent_name: "lead_agent", thread_id: "thread-1" },
      input: { messages: [{ content: "prepared" }] },
      metadata: { source: "regenerate" },
      text: "replay",
      threadId: "thread-1",
    });
    expect(options.refetchHistory).toHaveBeenCalledOnce();
  });

  it("sends human-input responses through the existing hidden metadata boundary", async () => {
    const { actions, options } = createActions();

    await expect(actions.submitHumanInput(
      { input_mode: "free_text", prompt: "Approve", request_id: "request-1", title: "Approval" },
      { response_kind: "text", value: "approved" },
    )).resolves.toBe(true);

    expect(options.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      additionalKwargs: {
        hide_from_ui: true,
        human_input_response: { response_kind: "text", value: "approved" },
      },
      threadId: "thread-1",
    }));
    expect(options.refetchThreads).toHaveBeenCalledOnce();
  });
});
