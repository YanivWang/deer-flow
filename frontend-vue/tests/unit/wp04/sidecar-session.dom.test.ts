import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref, type EffectScope } from "vue";

import { useSidecarSession } from "@/composables/useSidecarSession";

const mocks = vi.hoisted(() => ({
  findLatestSidecarThread: vi.fn(),
  createSidecarThread: vi.fn(),
  uploadFiles: vi.fn(),
  fetchWithAuth: vi.fn(),
  stream: undefined as
    | {
        messages: { value: unknown[] };
        isStreaming: { value: boolean };
        isUploading: { value: boolean };
        isHistoryLoading: { value: boolean };
        error: { value: unknown };
        sendMessage: ReturnType<typeof vi.fn>;
      }
    | undefined,
}));

vi.mock("@/core/sidecar/api", () => ({
  findLatestSidecarThread: mocks.findLatestSidecarThread,
  createSidecarThread: mocks.createSidecarThread,
}));
vi.mock("@/core/uploads/api", () => ({
  uploadFiles: mocks.uploadFiles,
}));
vi.mock("@/core/api/fetcher", () => ({ fetch: mocks.fetchWithAuth }));
vi.mock("@/core/config", () => ({ getBackendBaseURL: () => "" }));
vi.mock("@/composables/useUploads", () => ({
  useUploadLimits: () => ({
    data: { value: undefined },
  }),
}));
vi.mock("@/composables/useThreadStream", async () => {
  const { ref: vueRef } = await import("vue");
  return {
    useThreadStream: () => {
      const stream = {
        messages: vueRef([]),
        isStreaming: vueRef(false),
        isUploading: vueRef(false),
        isHistoryLoading: vueRef(false),
        error: vueRef(null),
        sendMessage: vi.fn(),
      };
      mocks.stream = stream;
      return stream;
    },
  };
});

function reference(id = 1) {
  return {
    id,
    context: {
      type: "referenced_message" as const,
      label: `Selected assistant text #${id}`,
      messageId: `message-${id}`,
      role: "assistant" as const,
      content: `Context ${id}`,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("WP-04 useSidecarSession", () => {
  let scope: EffectScope;

  beforeEach(() => {
    mocks.findLatestSidecarThread.mockReset().mockResolvedValue(null);
    mocks.createSidecarThread
      .mockReset()
      .mockResolvedValue({ thread_id: "sidecar-1" });
    mocks.uploadFiles.mockReset();
    mocks.fetchWithAuth
      .mockReset()
      .mockResolvedValue(new Response(null, { status: 204 }));
    mocks.stream = undefined;
    scope = effectScope();
  });

  afterEach(() => scope.stop());

  function setup() {
    const parentThreadId = ref<string | null>("parent-1");
    const parentMessages = ref([]);
    const sidecarThreadId = ref<string | null>(null);
    const references = ref([reference()]);
    const context = ref({ model_name: "reasoner", mode: "pro" });
    const session = scope.run(() =>
      useSidecarSession({
        parentThreadId,
        parentMessages,
        sidecarThreadId,
        references,
        context,
        onReferencesAccepted(accepted) {
          const acceptedIds = new Set(accepted.map((item) => item.id));
          references.value = references.value.filter(
            (item) => !acceptedIds.has(item.id),
          );
        },
      }),
    )!;
    return {
      parentThreadId,
      sidecarThreadId,
      references,
      session,
      stream: mocks.stream!,
    };
  }

  it("uploads selected files to the restored-or-created thread and clears only on acceptance", async () => {
    const file = new File(["hello"], "notes.txt");
    mocks.uploadFiles.mockResolvedValue({
      success: true,
      files: [
        {
          filename: "notes.txt",
          size: file.size,
          path: "/tmp/notes.txt",
          virtual_path: "/mnt/user-data/uploads/notes.txt",
          artifact_url: "/artifact",
        },
      ],
      message: "ok",
      skipped_files: [],
    });
    const { session, stream, references } = setup();
    await flushPromises();
    session.input.value = "Review it";
    session.addFiles([file]);
    stream.sendMessage.mockImplementation(
      async (_threadId, _message, _context, options) => {
        options.onAccepted();
        return true;
      },
    );

    await expect(session.submit()).resolves.toBe(true);
    expect(mocks.uploadFiles).toHaveBeenCalledWith("sidecar-1", [file]);
    expect(stream.sendMessage).toHaveBeenCalledWith(
      "sidecar-1",
      {
        text: "Review it",
        files: [
          {
            filename: "notes.txt",
            size: file.size,
            path: "/mnt/user-data/uploads/notes.txt",
            status: "uploaded",
          },
        ],
      },
      undefined,
      expect.objectContaining({
        additionalInputMessages: expect.any(Array),
        additionalKwargs: expect.objectContaining({
          sidecar_visible_message: true,
        }),
        onAccepted: expect.any(Function),
      }),
    );
    expect(session.input.value).toBe("");
    expect(session.selectedFiles.value).toEqual([]);
    expect(references.value).toEqual([]);
  });

  it("keeps the draft after run failure and reuses its successful upload", async () => {
    const file = new File(["hello"], "notes.txt");
    mocks.uploadFiles.mockResolvedValue({
      success: true,
      files: [
        {
          filename: "notes.txt",
          size: file.size,
          path: "/tmp/notes.txt",
          virtual_path: "/mnt/user-data/uploads/notes.txt",
          artifact_url: "/artifact",
        },
      ],
      message: "ok",
      skipped_files: [],
    });
    const { session, stream } = setup();
    await flushPromises();
    session.input.value = "Retry me";
    session.addFiles([file]);
    stream.sendMessage
      .mockRejectedValueOnce(new Error("run rejected"))
      .mockImplementationOnce(
        async (_threadId, _message, _context, options) => {
          options.onAccepted();
          return true;
        },
      );

    await expect(session.submit()).resolves.toBe(false);
    expect(session.input.value).toBe("Retry me");
    expect(session.selectedFiles.value).toEqual([file]);

    await expect(session.submit()).resolves.toBe(true);
    expect(mocks.uploadFiles).toHaveBeenCalledTimes(1);
    expect(session.input.value).toBe("");
    expect(session.selectedFiles.value).toEqual([]);
  });

  it("drops duplicate submission and ignores stale upload results after a route change", async () => {
    const upload = deferred<{
      success: boolean;
      files: Array<{
        filename: string;
        size: number;
        path: string;
        virtual_path: string;
        artifact_url: string;
      }>;
      message: string;
      skipped_files: string[];
    }>();
    const file = new File(["old"], "old.txt");
    mocks.uploadFiles.mockReturnValue(upload.promise);
    const { session, stream, parentThreadId } = setup();
    await flushPromises();
    session.input.value = "Old route draft";
    session.addFiles([file]);

    const first = session.submit();
    await expect(session.submit()).resolves.toBe(false);
    parentThreadId.value = "parent-2";
    await nextTick();
    upload.resolve({
      success: true,
      files: [
        {
          filename: "old.txt",
          size: file.size,
          path: "/tmp/old.txt",
          virtual_path: "/mnt/user-data/uploads/old.txt",
          artifact_url: "/artifact",
        },
      ],
      message: "ok",
      skipped_files: [],
    });
    await expect(first).resolves.toBe(false);
    expect(stream.sendMessage).not.toHaveBeenCalled();

    parentThreadId.value = "parent-1";
    await nextTick();
    expect(session.input.value).toBe("Old route draft");
    expect(session.selectedFiles.value).toEqual([file]);
  });

  it("submits HIL to the sidecar thread, reports false on failure, and allows retry", async () => {
    mocks.findLatestSidecarThread.mockResolvedValue({
      thread_id: "restored-sidecar",
    });
    const { session, stream } = setup();
    await flushPromises();
    const request = {
      version: 2 as const,
      kind: "human_input_request" as const,
      source: "ask_clarification" as const,
      request_id: "request-1",
      question: "Ship it?",
      input_mode: "form" as const,
      fields: [
        {
          name: "approved",
          label: "Approved",
          type: "checkbox" as const,
          required: false,
        },
      ],
    };
    const response = {
      version: 1 as const,
      kind: "human_input_response" as const,
      source: "ask_clarification" as const,
      request_id: "request-1",
      response_kind: "text" as const,
      value: 'Approved: no [values: {"approved":false}]',
    };
    stream.sendMessage
      .mockResolvedValueOnce(false)
      .mockImplementationOnce(
        async (_threadId, _message, _context, options) => {
          options.onAccepted();
          return true;
        },
      );

    await expect(session.submitHumanInput(request, response)).resolves.toBe(
      false,
    );
    await expect(session.submitHumanInput(request, response)).resolves.toBe(
      true,
    );
    expect(stream.sendMessage).toHaveBeenLastCalledWith(
      "restored-sidecar",
      { text: expect.stringContaining("false") },
      undefined,
      {
        additionalKwargs: {
          hide_from_ui: true,
          human_input_response: response,
        },
        onAccepted: expect.any(Function),
      },
    );
  });
});
