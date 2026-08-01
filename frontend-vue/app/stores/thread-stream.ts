import { defineStore } from "pinia";
import { computed, markRaw, ref } from "vue";

import {
  cancelDeerFlowThreadStream,
  joinDeerFlowThreadStream,
  startDeerFlowThreadStream,
  type DeerFlowRunInput,
} from "../core/api/stream/client";
import type { CanonicalStreamEvent } from "../core/api/stream/canonical";
import { ThreadStreamEngine } from "../core/api/stream/engine";
import type { StreamSnapshot } from "../core/api/stream/reducer";
import {
  deriveThreadStreamViewModel,
  type ThreadStreamStatus,
} from "../core/api/stream/view-model";
import type { DeerFlowMessage } from "../core/api/thread/types";

export type StartThreadMessageOptions = {
  threadId: string;
  text: string;
  additionalKwargs?: Record<string, unknown>;
  context?: Record<string, unknown>;
  endpointBase?: string;
};

export type JoinThreadStreamOptions = {
  threadId: string;
  runId: string;
  endpointBase?: string;
  lastEventId?: string;
};

export type StopThreadStreamOptions = {
  drain?: boolean;
};

export const useThreadStreamStore = defineStore("thread-stream", () => {
  const engine = markRaw(new ThreadStreamEngine());
  const snapshot = ref<StreamSnapshot>(engine.getSnapshot());
  const activeThreadId = ref<string | null>(null);
  const activeRunId = ref<string | null>(null);
  const historyMessages = ref<DeerFlowMessage[]>([]);
  const status = ref<ThreadStreamStatus>("idle");
  const errorMessage = ref<string | null>(null);
  let controller: AbortController | undefined;

  engine.subscribe(() => {
    snapshot.value = engine.getSnapshot();
  });

  const viewModel = computed(() =>
    deriveThreadStreamViewModel(snapshot.value, {
      errorMessage: errorMessage.value,
      historyMessages: historyMessages.value,
      runId: activeRunId.value,
      status: status.value,
      threadId: activeThreadId.value,
    }),
  );
  const isStreaming = computed(() => status.value === "streaming" || status.value === "recovering");
  const isBusy = computed(() => isStreaming.value || status.value === "stopping");

  async function sendMessage({
    threadId,
    text,
    additionalKwargs,
    context,
    endpointBase,
  }: StartThreadMessageOptions): Promise<void> {
    await stop({ drain: false });
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    const runController = new AbortController();
    controller = runController;
    activeThreadId.value = threadId;
    activeRunId.value = null;
    errorMessage.value = null;
    status.value = "streaming";

    const input: DeerFlowRunInput = {
      messages: [
        {
          type: "human",
          content: trimmed,
          ...(additionalKwargs ? { additional_kwargs: additionalKwargs } : {}),
        },
      ],
    };

    try {
      const result = await startDeerFlowThreadStream({
        context,
        endpointBase,
        engine,
        input,
        onEvent: handleStreamEvent,
        signal: runController.signal,
        threadId,
      });
      activeRunId.value = result.runId ?? null;
    } catch (error) {
      if (!runController.signal.aborted) {
        errorMessage.value = error instanceof Error ? error.message : "Stream failed.";
        status.value = "error";
      }
    } finally {
      if (controller === runController) {
        controller = undefined;
        if (isRunningStatus(status.value)) {
          status.value = snapshot.value.done ? "completed" : "idle";
        }
      }
    }
  }

  async function joinRun({
    threadId,
    runId,
    endpointBase,
    lastEventId,
  }: JoinThreadStreamOptions): Promise<void> {
    await stop({ drain: false });
    const runController = new AbortController();
    controller = runController;
    activeThreadId.value = threadId;
    activeRunId.value = runId;
    errorMessage.value = null;
    status.value = "streaming";

    try {
      await joinDeerFlowThreadStream({
        endpointBase,
        engine,
        lastEventId,
        onEvent: handleStreamEvent,
        runId,
        signal: runController.signal,
        threadId,
      });
    } catch (error) {
      if (!runController.signal.aborted) {
        errorMessage.value = error instanceof Error ? error.message : "Join stream failed.";
        status.value = "error";
      }
    } finally {
      if (controller === runController) {
        controller = undefined;
        if (isRunningStatus(status.value)) {
          status.value = snapshot.value.done ? "completed" : "idle";
        }
      }
    }
  }

  async function stop({ drain = true }: StopThreadStreamOptions = {}): Promise<void> {
    const stoppedThreadId = activeThreadId.value;
    const stoppedRunId = activeRunId.value;
    controller?.abort();
    controller = undefined;
    if (!drain || !stoppedThreadId || !stoppedRunId) {
      if (isRunningStatus(status.value)) {
        status.value = "aborted";
      }
      return;
    }

    const drainController = new AbortController();
    status.value = "stopping";
    try {
      await cancelDeerFlowThreadStream({
        engine,
        onEvent: handleStreamEvent,
        runId: stoppedRunId,
        signal: drainController.signal,
        threadId: stoppedThreadId,
      });
      status.value = snapshot.value.done ? "completed" : "aborted";
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Stop failed.";
      status.value = "error";
    }
  }

  function reset(): void {
    void stop({ drain: false });
    activeThreadId.value = null;
    activeRunId.value = null;
    historyMessages.value = [];
    errorMessage.value = null;
    status.value = "idle";
    engine.reset();
    snapshot.value = engine.getSnapshot();
  }

  function setHistoryMessages(messages: DeerFlowMessage[]): void {
    historyMessages.value = messages;
  }

  function isRunningStatus(value: ThreadStreamStatus): boolean {
    return value === "streaming" || value === "recovering";
  }

  function handleStreamEvent(event: CanonicalStreamEvent): void {
    if (event.type === "connected") {
      activeRunId.value = event.runId ?? activeRunId.value;
      activeThreadId.value = event.threadId ?? activeThreadId.value;
      return;
    }
    if (event.type === "stream_gap") {
      status.value = "recovering";
      return;
    }
    if (event.type === "message_snapshot" && status.value === "recovering") {
      status.value = "streaming";
      return;
    }
    if (event.type === "done") {
      status.value = "completed";
      return;
    }
    if (event.type === "aborted") {
      status.value = status.value === "stopping" ? "stopping" : "aborted";
      return;
    }
    if (event.type === "error") {
      errorMessage.value = event.error.message;
      status.value = "error";
    }
  }

  return {
    activeRunId,
    activeThreadId,
    errorMessage,
    isBusy,
    isStreaming,
    joinRun,
    reset,
    sendMessage,
    setHistoryMessages,
    snapshot,
    status,
    stop,
    viewModel,
  };
});
