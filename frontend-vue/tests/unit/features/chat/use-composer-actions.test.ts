import { computed, ref } from "vue";

import { useComposerActions, type ComposerUploadLimits } from "../../../../app/features/chat/send-message/use-composer-actions";

function response(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "application/json" },
  });
}

function createActions(overrides: Partial<Parameters<typeof useComposerActions>[0]> = {}) {
  const draft = ref("hello");
  const selectedSlashSkill = ref<string | null>("research");
  const editingMessageId = ref<string | null>("message-1");
  const threadId = ref("thread-1");
  const options: Parameters<typeof useComposerActions>[0] = {
    agentName: computed(() => "lead_agent"),
    clearDraft: vi.fn(),
    createThread: vi.fn(async () => ({ thread_id: "created-thread" })),
    draft,
    editingMessageId,
    historyPrompts: computed(() => ["previous prompt"]),
    isBusy: computed(() => false),
    matchingSkills: computed(() => []),
    onGoalCommand: vi.fn(),
    refetchHistory: vi.fn(async () => undefined),
    refetchThreads: vi.fn(async () => undefined),
    replaceThreadRoute: vi.fn(async () => undefined),
    saveGoal: vi.fn(async () => undefined),
    selectedSlashSkill,
    sendMessage: vi.fn(async () => undefined),
    threadId,
    threadRunContext: computed(() => ({ model_name: "test-model" })),
    ...overrides,
  };
  return { actions: useComposerActions(options), options, draft, editingMessageId, selectedSlashSkill };
}

describe("useComposerActions", () => {
  it("uploads accepted attachments with authenticated requests and forwards the file metadata", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ files: [{ filename: "notes.txt", size: 5, path: "tmp/notes.txt", virtual_path: "workspace/notes.txt" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const { actions, options } = createActions();
    const input = document.createElement("input");
    input.type = "file";
    Object.defineProperty(input, "files", { value: [new File(["hello"], "notes.txt", { type: "text/plain" })] });

    actions.acceptAttachments({ target: input } as unknown as Event);
    await actions.submitMessage();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/threads/thread-1/uploads",
      expect.objectContaining({ credentials: "include", method: "POST" }),
    );
    expect(options.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      additionalKwargs: {
        files: [{ filename: "notes.txt", path: "workspace/notes.txt", size: 5, status: "uploaded" }],
      },
      text: "/research hello",
      threadId: "thread-1",
    }));
  });

  it("preserves undo and abort behavior for input polishing", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const { actions, draft } = createActions();

    void actions.polishDraft();
    await Promise.resolve();
    const signal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    actions.cancelPolishDraft();
    expect(signal.aborted).toBe(true);
    resolveFetch?.(response({ changed: false }));
    await Promise.resolve();
    expect(draft.value).toBe("hello");
  });

  it("creates a new thread and preserves goal command routing before streaming", async () => {
    const { actions, options } = createActions({
      threadId: ref("new"),
      draft: ref("/goal finish migration"),
      selectedSlashSkill: ref(null),
    });

    await actions.submitMessage();

    expect(options.createThread).toHaveBeenCalledWith(expect.objectContaining({ agentName: "lead_agent" }));
    expect(options.saveGoal).toHaveBeenCalledWith("finish migration", "created-thread");
    expect(options.replaceThreadRoute).toHaveBeenCalledWith("created-thread");
    expect(options.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      text: "/goal finish migration",
      threadId: "created-thread",
    }));
    expect(options.draft.value).toBe("");
    expect(options.selectedSlashSkill.value).toBe(null);
  });

  it("keeps upload limits conservative when the limits endpoint is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({}, false)));
    const { actions } = createActions();

    await actions.loadUploadLimits();

    const limits = actions.uploadLimits.value satisfies ComposerUploadLimits;
    expect(limits.max_files).toBe(10);
    expect(limits.max_total_size).toBe(100 * 1024 * 1024);
  });
});
