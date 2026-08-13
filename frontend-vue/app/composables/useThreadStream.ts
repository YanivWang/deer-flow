/*
  【文件职责】     一个 thread 的完整数据流：历史 + 实时 + 乐观三路的归并与生命周期。
  【对应 frontend/】 core/threads/hooks.ts 的 useThreadStream（1,408–2,489 行）
  【架构位置】     L3（Vue 适配）
  【主要导出】     useThreadStream
  【依赖关系】     @/core/agent-deerflow/thread-runner · @/core/threads/*
                   ./useThreadHistory · ./useCoalescedStreamMessages
  【边界与注意】   ⚠️ **本文件承载 05 C5 / C8 / C9 与 A7 / A8 的生命周期部分。**
                   排序与归并的规则在 `@/core/threads/` 的纯函数里，这里只管
                   「什么时候取基线、什么时候清、什么时候失效缓存」。

                   三个 ref 的生命周期是 C9 的全部内容，值得逐条写死：
                   - `localTurnOrderBaseline`：**非 null 才代表「本地提交过」**。
                     空 set 与 null 不是一回事——新 thread 的第一次提交基线就是
                     空 set，把它当 null 会让第一个回合失去顺序锚点。
                     finish / stop / error **之后仍然保留**（协议的瞬态顺序会活到
                     settled 帧），下一次本地提交时替换，切 thread 或 gap 时清除。
                   - `transientHistoryBridge*`：只在当前 thread 有效，用
                     `transientHistoryThreadId` 守着，跨 thread 一律不生效。
                   - `renderedMessageSnapshot`：run 作用域的已提交账本（C3）。

                   **A7 的触发点是 `custom` 帧里的 `stream_replay_gap`**，
                   不是合成的那帧 `values`——见 gap-recovery.ts 里同名的注释，
                   那是本窗口实测订正 06 的一处。

                   `isMock` 上游有 23 处，这里**一处都没有**。mock 流的替身是
                   注入 `runnerFactory`：测试给一个假 runner，代码路径与生产完全
                   同一条。上游那 23 个分支等于让生产路径与测试路径分叉，
                   而分叉的那一侧没有测试。
*/

import type { InfiniteData } from "@tanstack/vue-query";
import { useQueryClient } from "@tanstack/vue-query";
import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  triggerRef,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

import type { DeerFlowRunHandle } from "@/core/agent-deerflow/endpoints";
import type {
  ThreadRunner,
  ThreadRunnerOptions,
} from "@/core/agent-deerflow/thread-runner";
import { createThreadRunner } from "@/core/agent-deerflow/thread-runner";
import { createDeerFlowRunProtocol } from "@/core/agent-deerflow/run-protocol";
import { getBackendBaseURL, getLangGraphBaseURL } from "@/core/config";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import {
  createGapRecoveryReset,
  invalidateStoppedThreadCaches,
  stopThreadAndInvalidateCaches,
} from "@/core/threads/cache-invalidation";
import {
  INFINITE_THREADS_QUERY_KEY_PREFIX,
  mapInfiniteThreadsCache,
} from "@/core/threads/infinite";
import type { AgentThread } from "@/core/threads/types";
import { restoreLocalTurnMessageOrder } from "@/core/threads/local-turn-order";
import {
  isNonEmptyString,
  messageIdentity,
  removeSetItems,
} from "@/core/threads/message-identity";
import {
  areOptimisticMessagesConfirmed,
  computeSummarizationTransientMessages,
  EMPTY_MESSAGES,
  EMPTY_MESSAGE_IDENTITIES,
  getSummarizationMiddlewareMessages,
  getVisibleOptimisticMessages,
  mergeMessages,
  mergeRenderedMessageLedger,
  mergeTransientHistoryBridge,
  mergeTransientHistoryBridgeOrder,
  pruneConfirmedTransientMessages,
  resolveThreadTransientHistoryBridge,
} from "@/core/threads/message-merge";
import {
  buildRunContext,
  buildThreadSubmitMessages,
  type ThreadRunContextInput,
} from "@/core/threads/submit";
import { isHiddenFromUIMessage } from "@/core/messages/utils";
import type { FileInMessage } from "@/core/messages/utils";
import type { Message } from "@/core/types/message";

import { useCoalescedStreamMessages } from "./useCoalescedStreamMessages";
import { useThreadHistory } from "./useThreadHistory";

export interface ThreadStreamNotifier {
  /** 本地化恢复警告（05 A7）。key 是字典路径，文案由调用方取。 */
  warn: (key: string) => void;
  error: (message: string) => void;
}

export interface UseThreadStreamOptions {
  threadId: MaybeRefOrGetter<string | null | undefined>;
  displayThreadId?: MaybeRefOrGetter<string | null | undefined>;
  context: MaybeRefOrGetter<ThreadRunContextInput>;
  notify?: ThreadStreamNotifier;
  onSend?: (threadId: string) => void;
  onStart?: (threadId: string, runId: string) => void;
  onFinish?: (state: Record<string, unknown>) => void;
  /** 测试注入点，取代上游的 23 处 `isMock`。 */
  runnerFactory?: (options: ThreadRunnerOptions) => ThreadRunner;
}

const noopNotifier: ThreadStreamNotifier = { warn: () => {}, error: () => {} };

function identitiesOf(messages: Message[]): Set<string> {
  return new Set(messages.map(messageIdentity).filter(isNonEmptyString));
}

export function useThreadStream(options: UseThreadStreamOptions) {
  const {
    threadId: threadIdInput,
    displayThreadId: displayThreadIdInput,
    context,
    notify = noopNotifier,
    onSend,
    onStart,
    onFinish,
    runnerFactory = createThreadRunner,
  } = options;

  const queryClient = useQueryClient();

  const threadId = computed(() => toValue(threadIdInput) ?? null);
  const currentViewThreadId = computed(
    () => toValue(displayThreadIdInput) ?? threadId.value,
  );

  // ---- 本地 UI 状态 -------------------------------------------------------
  const optimisticMessages = ref<Message[]>([]);
  const optimisticThreadId = ref<string | null>(null);
  const liveMessagesThreadId = ref<string | null>(null);
  const pendingSupersededRunIds = ref<ReadonlySet<string>>(new Set());
  const pendingSupersededMessageIds = ref<ReadonlySet<string>>(new Set());
  const isUploading = ref(false);

  // ---- 非响应式簿记（C3 / C8 / C9） --------------------------------------
  let localTurnOrderBaseline: Set<string> | null = null;
  let transientHistoryBridge: Message[] = [];
  let transientHistoryOrder: readonly string[] = EMPTY_MESSAGE_IDENTITIES;
  let transientHistoryThreadId: string | null = null;
  let renderedMessageSnapshot: {
    threadId: string | null;
    messages: Message[];
    order: readonly string[];
  } = {
    threadId: null,
    messages: EMPTY_MESSAGES,
    order: EMPTY_MESSAGE_IDENTITIES,
  };
  let summarizedMessageIds = new Set<string>();
  let sendInFlight = false;
  let startedAnnounced = false;
  /**
   * 本次 run 真正建出来的 thread id（05 C9 的边界条件）。
   *
   * 新会话是 `/chats/new` 提交 → 后端建出 thread → URL replace 成真 id，
   * 于是 `threadId` 会从 `null` 变成一个具体值。**那不是「切换 thread」**，
   * 是同一个 thread 拿到了自己的身份；照 C9 的字面意思在这里清掉顺序锚点，
   * 第一个回合的 C8 重排当场失效（表现：先到的 AI 步骤永远排在 human 前面）。
   *
   * 上游没踩到这条，只是因为它那份 `local-turn-order` 用例用的是固定
   * `threadId: "thread-1"`，从来没走过 new → id 这一步。
   */
  let adoptedThreadId: string | null = null;
  let pendingFinalizationTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- runner ------------------------------------------------------------
  const snapshotVersion = shallowRef(0);
  const sessionStatus = ref<string>("idle");

  const runner: ThreadRunner = runnerFactory({
    protocol: createDeerFlowRunProtocol({ baseUrl: getLangGraphBaseURL() }),
    async loadDurableState(handle: DeerFlowRunHandle) {
      const response = await globalThis.fetch(
        `${getBackendBaseURL()}/api/threads/${encodeURIComponent(handle.threadId)}/state`,
        { credentials: "include" },
      );
      if (!response.ok) return undefined;
      const body = (await response.json()) as {
        values?: Record<string, unknown>;
      };
      return body.values;
    },
    onSnapshot() {
      snapshotVersion.value += 1;
      triggerRef(snapshotVersion);
      sessionStatus.value = runner.getSessionState().status;
    },
    onSessionState(state) {
      sessionStatus.value = state.status;
    },
    onStart(handle) {
      handleStreamStart(handle.threadId, handle.runId);
    },
    onUpdateEvent: handleUpdateEvent,
    onCustomEvent: handleCustomEvent,
    onError(error) {
      sessionStatus.value = runner.getSessionState().status;
      handleStreamError(error);
    },
    onSettled(state) {
      sessionStatus.value = state.status;
      if (state.status === "completed" || state.status === "cancelled") {
        handleStreamFinish();
      }
    },
  });

  onScopeDispose(() => {
    if (pendingFinalizationTimer !== null) {
      clearTimeout(pendingFinalizationTimer);
    }
    runner.abort();
  });

  const isStreaming = computed(() =>
    ["creating", "streaming", "reconnecting", "stopping"].includes(
      sessionStatus.value,
    ),
  );

  // ---- 历史 --------------------------------------------------------------
  const history = useThreadHistory(() => threadId.value ?? "", {
    enabled: computed(() => Boolean(threadId.value)),
    pendingSupersededRunIds,
  });

  const visibleHistory = computed(() =>
    threadId.value ? history.messages.value : EMPTY_MESSAGES,
  );

  // ---- 实时消息 ----------------------------------------------------------
  const hasVisibleStreamState = computed(
    () =>
      Boolean(threadId.value) ||
      liveMessagesThreadId.value === currentViewThreadId.value,
  );

  const persistedMessages = computed<Message[]>(() => {
    void snapshotVersion.value;
    if (!hasVisibleStreamState.value) return EMPTY_MESSAGES;
    const masked = pendingSupersededMessageIds.value;
    const filtered = runner
      .getWireMessages()
      .filter((message) => !message.id || !masked.has(message.id));
    return filtered.length === 0 ? EMPTY_MESSAGES : filtered;
  });

  const humanMessageCount = computed(
    () => persistedMessages.value.filter((m) => m.type === "human").length,
  );
  let previousHumanMessageCount = 0;

  const { messages: renderMessages } = useCoalescedStreamMessages(
    persistedMessages,
    isStreaming,
  );

  // ---- 事件处理 ----------------------------------------------------------
  function handleStreamStart(startedThreadId: string, runId: string) {
    if (
      optimisticThreadId.value &&
      (optimisticThreadId.value === currentViewThreadId.value ||
        optimisticThreadId.value === startedThreadId ||
        sendInFlight)
    ) {
      optimisticThreadId.value = startedThreadId;
    }
    if (
      liveMessagesThreadId.value &&
      (liveMessagesThreadId.value === currentViewThreadId.value ||
        liveMessagesThreadId.value === startedThreadId)
    ) {
      liveMessagesThreadId.value = startedThreadId;
    }
    adoptedThreadId = startedThreadId;
    if (!startedAnnounced) {
      onStart?.(startedThreadId, runId);
      startedAnnounced = true;
    }
  }

  function handleUpdateEvent(data: unknown) {
    const summarization = getSummarizationMiddlewareMessages(data);
    if (summarization && summarization.length >= 2) {
      for (const message of summarization) {
        // 兼容垫片：旧线程可能还带着 name="summary" 的合成 HumanMessage。
        if (message.name === "summary" && message.type === "human") {
          summarizedMessageIds.add(message.id ?? "");
        }
      }
      const captured = computeSummarizationTransientMessages(
        persistedMessages.value,
        summarization,
        summarizedMessageIds,
        renderedMessageSnapshot.threadId === threadId.value
          ? renderedMessageSnapshot.messages
          : EMPTY_MESSAGES,
      );
      transientHistoryOrder = mergeTransientHistoryBridgeOrder(
        transientHistoryOrder,
        captured,
      );
      transientHistoryBridge = mergeTransientHistoryBridge(
        transientHistoryBridge,
        captured,
      );
      transientHistoryThreadId = threadId.value;
    }

    // 标题定稿：**只补丁已有条目的 title，不 upsert 整条 thread。**
    //
    // 上游把这两件事分得很清楚：`upsertThreadIn*` 只在 `onCreated` 用
    // （那时确实要凭空插一条新 thread 进侧栏），标题更新走的是
    // `setQueriesData` + 只改 `values.title` 的 mapper（hooks.ts:1617/1638）。
    // 第一版这里错用了 upsert，于是不得不造一个假的完整 `AgentThread`
    // 去喂类型——那个占位对象的 `metadata: {}` / `status: "busy"` 会把
    // 侧栏里这条 thread 的真实元数据**覆盖掉**（upsert 的浅并方向是
    // 「已有的赢」，但凭空造出来的字段在缓存为空时会原样落进去）。
    if (typeof data !== "object" || data === null) return;
    const id = threadId.value;
    if (!id) return;
    for (const update of Object.values(data)) {
      const title =
        typeof update === "object" && update !== null
          ? Reflect.get(update, "title")
          : undefined;
      if (typeof title !== "string" || !title) continue;
      const withTitle = (thread: AgentThread): AgentThread =>
        thread.thread_id === id
          ? { ...thread, values: { ...thread.values, title } }
          : thread;

      queryClient.setQueriesData(
        { queryKey: ["threads", "search"], exact: false },
        (oldData: AgentThread[] | undefined) => oldData?.map(withTitle),
      );
      queryClient.setQueriesData(
        { queryKey: [...INFINITE_THREADS_QUERY_KEY_PREFIX], exact: false },
        (oldData: InfiniteData<AgentThread[]> | undefined) =>
          mapInfiniteThreadsCache(oldData, withTitle),
      );
    }
  }

  /** 05 A7。触发点是 `custom` 帧，理由见 gap-recovery.ts。 */
  function handleCustomEvent(data: unknown) {
    const type =
      typeof data === "object" && data !== null
        ? Reflect.get(data, "type")
        : undefined;
    if (type !== "stream_replay_gap") return;

    const reset = createGapRecoveryReset();
    if (reset.clearOptimistic) {
      optimisticMessages.value = [];
      optimisticThreadId.value = null;
      liveMessagesThreadId.value = null;
      pendingSupersededRunIds.value = new Set();
      pendingSupersededMessageIds.value = new Set();
    }
    if (reset.clearTransientBridge) {
      transientHistoryBridge = [];
      transientHistoryOrder = EMPTY_MESSAGE_IDENTITIES;
      transientHistoryThreadId = null;
      summarizedMessageIds = new Set();
      localTurnOrderBaseline = null;
    }
    invalidateStoppedThreadCaches(queryClient, threadId.value);
    notify.warn(reset.warningKey);
  }

  function handleStreamError(error: Error) {
    optimisticMessages.value = [];
    optimisticThreadId.value = null;
    liveMessagesThreadId.value = null;
    pendingSupersededRunIds.value = new Set();
    pendingSupersededMessageIds.value = new Set();
    notify.error(error.message || "Request failed.");
    if (threadId.value) {
      invalidateStoppedThreadCaches(queryClient, threadId.value);
    }
  }

  function handleStreamFinish() {
    onFinish?.(runner.getSnapshot().state);
    invalidateStoppedThreadCaches(queryClient, threadId.value);
  }

  // ---- 切 thread 时的清场（C9 的「切换 thread 时清除」） ------------------
  watch(threadId, (next, previous) => {
    // `new` 提交后 URL 换成真 id：同一个 thread，不清场。见 adoptedThreadId。
    if (previous === null && next !== null && next === adoptedThreadId) return;
    runner.reset();
    startedAnnounced = false;
    sendInFlight = false;
    transientHistoryBridge = [];
    transientHistoryOrder = EMPTY_MESSAGE_IDENTITIES;
    transientHistoryThreadId = null;
    renderedMessageSnapshot = {
      threadId: null,
      messages: EMPTY_MESSAGES,
      order: EMPTY_MESSAGE_IDENTITIES,
    };
    summarizedMessageIds = new Set();
    localTurnOrderBaseline = null;
    pendingSupersededRunIds.value = new Set();
    pendingSupersededMessageIds.value = new Set();
    previousHumanMessageCount = humanMessageCount.value;
  });

  // 历史确认后逐条释放瞬态桥。immediate 见 05 M5：首屏那一批确认不能漏。
  watch(
    visibleHistory,
    (rows) => {
      transientHistoryBridge = pruneConfirmedTransientMessages(
        transientHistoryBridge,
        rows,
      );
      if (transientHistoryBridge.length === 0) {
        transientHistoryOrder = EMPTY_MESSAGE_IDENTITIES;
        transientHistoryThreadId = null;
      }
    },
    { immediate: true },
  );

  watch([currentViewThreadId], ([viewId]) => {
    if (optimisticThreadId.value && optimisticThreadId.value !== viewId) {
      optimisticMessages.value = [];
      optimisticThreadId.value = null;
    }
    if (liveMessagesThreadId.value && liveMessagesThreadId.value !== viewId) {
      liveMessagesThreadId.value = null;
    }
  });

  // 服务端消息到位后清乐观消息。带 human 的那种要等服务端的 human 到（C5 的
  // 「不要按时间戳重排序」正是靠这个等待，而不是靠排序）。
  watch([humanMessageCount, optimisticMessages], ([count, optimistic]) => {
    if (optimistic.length === 0) return;
    const hasHumanOptimistic = optimistic.some((m) => m.type === "human");
    if (!hasHumanOptimistic || count > previousHumanMessageCount) {
      optimisticMessages.value = [];
      optimisticThreadId.value = null;
      return;
    }
    if (areOptimisticMessagesConfirmed(optimistic, persistedMessages.value)) {
      optimisticMessages.value = [];
      optimisticThreadId.value = null;
    }
  });

  // ---- 归并 --------------------------------------------------------------
  const visibleOptimisticMessages = computed(() => {
    const raw = getVisibleOptimisticMessages(
      optimisticThreadId.value === currentViewThreadId.value
        ? optimisticMessages.value
        : EMPTY_MESSAGES,
      previousHumanMessageCount,
      humanMessageCount.value,
    );
    return raw.length === 0 ? EMPTY_MESSAGES : raw;
  });

  const mergedMessages = computed(() => {
    const bridgeOrder =
      transientHistoryBridge.length > 0 &&
      transientHistoryThreadId === threadId.value
        ? mergeTransientHistoryBridgeOrder(
            transientHistoryOrder,
            persistedMessages.value,
          )
        : transientHistoryOrder;
    const previouslyRenderedOrder =
      renderedMessageSnapshot.threadId === threadId.value
        ? renderedMessageSnapshot.order
        : EMPTY_MESSAGE_IDENTITIES;

    const effectiveHistory = resolveThreadTransientHistoryBridge(
      visibleHistory.value,
      transientHistoryBridge,
      transientHistoryThreadId,
      threadId.value,
      bridgeOrder,
      previouslyRenderedOrder,
    );
    const merged = mergeMessages(
      effectiveHistory,
      renderMessages.value,
      visibleOptimisticMessages.value,
    );
    return localTurnOrderBaseline === null
      ? merged
      : restoreLocalTurnMessageOrder(merged, localTurnOrderBaseline);
  });

  // 已提交显示账本（C3）。immediate 见 05 M5：第一帧就要进账本，
  // 否则第一次压缩救援拿到的是空的。
  watch(
    mergedMessages,
    (messages) => {
      const visible = messages.filter(
        (message) =>
          !isHiddenFromUIMessage(message) && !message.id?.startsWith("opt-"),
      );
      const previousLedger =
        renderedMessageSnapshot.threadId === threadId.value
          ? renderedMessageSnapshot.messages
          : EMPTY_MESSAGES;
      const ledger = mergeRenderedMessageLedger(
        previousLedger,
        visible,
        pendingSupersededMessageIds.value,
      );
      renderedMessageSnapshot = {
        threadId: threadId.value,
        messages: ledger,
        order: ledger.map(messageIdentity).filter(isNonEmptyString),
      };
    },
    { immediate: true },
  );

  // ---- 动作 --------------------------------------------------------------
  async function sendMessage(
    targetThreadId: string,
    message: { text: string; files?: FileInMessage[] },
    extraContext?: Record<string, unknown>,
    sendOptions?: {
      additionalKwargs?: Record<string, unknown>;
      onSent?: () => void;
    },
  ): Promise<void> {
    if (sendInFlight) return;
    sendInFlight = true;
    sendOptions?.onSent?.();

    const text = message.text.trim();
    previousHumanMessageCount = humanMessageCount.value;
    // C8：pre-submit 身份基线。空 set 与 null 不同，见文件头。
    localTurnOrderBaseline = identitiesOf(persistedMessages.value);

    const hideFromUI = sendOptions?.additionalKwargs?.hide_from_ui === true;
    const optimistic: Message[] = hideFromUI
      ? []
      : [
          {
            type: "human",
            id: `opt-human-${Date.now()}`,
            content: text ? [{ type: "text", text }] : "",
            additional_kwargs: { ...sendOptions?.additionalKwargs },
          } as Message,
        ];

    optimisticThreadId.value = targetThreadId;
    liveMessagesThreadId.value = targetThreadId;
    optimisticMessages.value = optimistic;
    onSend?.(targetThreadId);

    try {
      await runner.submit({
        threadId: targetThreadId,
        payload: {
          assistant_id: "lead_agent",
          input: {
            messages: buildThreadSubmitMessages({
              text,
              additionalKwargs: sendOptions?.additionalKwargs,
              filesForSubmit: message.files ?? [],
            }),
          },
          config: { recursion_limit: 1000 },
          context: buildRunContext(
            toValue(context),
            targetThreadId,
            extraContext,
          ),
        },
      });
      void queryClient.invalidateQueries({ queryKey: ["threads", "search"] });
      void queryClient.invalidateQueries({
        queryKey: [...INFINITE_THREADS_QUERY_KEY_PREFIX],
      });
    } catch (error) {
      optimisticMessages.value = [];
      optimisticThreadId.value = null;
      liveMessagesThreadId.value = null;
      isUploading.value = false;
      localTurnOrderBaseline = null;
      throw error;
    } finally {
      sendInFlight = false;
    }
  }

  type PreparedReplay = {
    input: { messages?: Message[] } & Record<string, unknown>;
    checkpoint?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    target_run_id: string;
    source_message_ids?: string[];
    replacement_human_message_id?: string;
  };

  async function submitPreparedReplay(
    targetThreadId: string,
    preparePath: string,
    prepareBody: Record<string, unknown>,
    fallbackSupersededMessageIds: readonly string[],
  ): Promise<boolean> {
    if (sendInFlight || !targetThreadId) return false;
    sendInFlight = true;
    previousHumanMessageCount = humanMessageCount.value;
    localTurnOrderBaseline = identitiesOf(persistedMessages.value);
    liveMessagesThreadId.value = targetThreadId;
    onSend?.(targetThreadId);

    let preparedRunId: string | null = null;
    let supersededMessageIds: readonly string[] = fallbackSupersededMessageIds;
    try {
      const response = await fetchWithAuth(
        `${getBackendBaseURL()}/api/threads/${encodeURIComponent(targetThreadId)}/runs/${preparePath}/prepare`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prepareBody),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to prepare ${preparePath}.`);
      }
      const prepared = (await response.json()) as PreparedReplay;
      preparedRunId = prepared.target_run_id;
      supersededMessageIds =
        prepared.source_message_ids ?? fallbackSupersededMessageIds;
      pendingSupersededRunIds.value = new Set([
        ...pendingSupersededRunIds.value,
        prepared.target_run_id,
      ]);
      pendingSupersededMessageIds.value = new Set([
        ...pendingSupersededMessageIds.value,
        ...supersededMessageIds,
      ]);

      const replacementMessages = prepared.input.messages ?? [];
      if (replacementMessages.length > 0) {
        optimisticThreadId.value = targetThreadId;
        optimisticMessages.value = replacementMessages;
      }

      await runner.submit({
        threadId: targetThreadId,
        payload: {
          assistant_id: "lead_agent",
          input: prepared.input,
          checkpoint: prepared.checkpoint,
          metadata: prepared.metadata,
          config: { recursion_limit: 1000 },
          context: buildRunContext(toValue(context), targetThreadId),
        },
      });
      void queryClient.invalidateQueries({ queryKey: ["threads", "search"] });
      return true;
    } catch (error) {
      optimisticMessages.value = [];
      optimisticThreadId.value = null;
      liveMessagesThreadId.value = null;
      localTurnOrderBaseline = null;
      if (preparedRunId) {
        clearPreparedReplayMasks(preparedRunId, supersededMessageIds);
      }
      notify.error(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      sendInFlight = false;
    }
  }

  function regenerateMessage(
    targetThreadId: string,
    messageId: string,
    supersededMessageIds: readonly string[] = [messageId],
  ) {
    return submitPreparedReplay(
      targetThreadId,
      "regenerate",
      { message_id: messageId },
      supersededMessageIds,
    );
  }

  function editAndRegenerateMessage(
    targetThreadId: string,
    humanMessageId: string,
    replacementText: string,
    supersededMessageIds: readonly string[] = [humanMessageId],
  ) {
    return submitPreparedReplay(
      targetThreadId,
      "edit-regenerate",
      {
        human_message_id: humanMessageId,
        replacement_text: replacementText,
      },
      supersededMessageIds,
    );
  }

  /** 05 A8。延迟那一次的 handle 留着，卸载时取消。 */
  async function stop(): Promise<void> {
    pendingFinalizationTimer = await stopThreadAndInvalidateCaches(
      queryClient,
      () => runner.stop(),
      threadId.value,
    );
  }

  function clearPreparedReplayMasks(
    targetRunId: string,
    supersededMessageIds: readonly string[],
  ) {
    pendingSupersededRunIds.value = removeSetItems(
      pendingSupersededRunIds.value,
      [targetRunId],
    );
    pendingSupersededMessageIds.value = removeSetItems(
      pendingSupersededMessageIds.value,
      supersededMessageIds,
    );
  }

  function resetView() {
    adoptedThreadId = null;
    runner.reset();
    optimisticMessages.value = [];
    optimisticThreadId.value = null;
    liveMessagesThreadId.value = null;
    renderedMessageSnapshot = {
      threadId: null,
      messages: EMPTY_MESSAGES,
      order: EMPTY_MESSAGE_IDENTITIES,
    };
    localTurnOrderBaseline = null;
  }

  return {
    messages: mergedMessages,
    state: computed(() => {
      void snapshotVersion.value;
      return runner.getSnapshot().state;
    }),
    isStreaming,
    isUploading: isUploading as Ref<boolean>,
    isHistoryLoading: history.loading,
    hasMoreHistory: history.hasMore,
    loadMoreHistory: history.loadMore,
    sendMessage,
    regenerateMessage,
    editAndRegenerateMessage,
    stop,
    clearPreparedReplayMasks,
    resetView,
    /** 测试与诊断用：不要在组件里读它。 */
    __runner: runner,
  };
}
