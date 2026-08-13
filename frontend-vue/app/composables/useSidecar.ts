/*
  【文件职责】     单个主 thread 的 sidecar 子会话、引用与恢复状态。
  【对应 frontend/】 frontend/src/components/workspace/sidecar/context.tsx
  【架构位置】     L3（DeerFlow sidecar）
  【主要导出】     useSidecar
  【依赖关系】     core/sidecar · thread submit context · AgentChat/SidecarPanel
  【边界与注意】   sidecar thread 与主 thread 隔离；切换主 thread 立即清场并
                   immediate 恢复，强制恢复会清掉后端已删除的缓存 id。
*/

import { reactive, ref, toValue, watch } from "vue";
import type { MaybeRefOrGetter } from "vue";

import type { Message } from "@/core/types/message";
import {
  appendSidecarReference,
  buildMessageSidecarContext,
  getNextSidecarOpenState,
  type SidecarContext,
  type SidecarReferenceStateItem,
} from "@/core/sidecar";
import { findLatestSidecarThread } from "@/core/sidecar/api";
import type { ThreadRunContextInput } from "@/core/threads/submit";

export type SidecarReference = SidecarReferenceStateItem;

export function useSidecar(options: {
  parentThreadId: MaybeRefOrGetter<string | null>;
  context: MaybeRefOrGetter<ThreadRunContextInput>;
}) {
  const open = ref(false);
  const activeReferences = ref<SidecarReference[]>([]);
  const conversationQuotes = ref<SidecarReference[]>([]);
  const sidecarThreadId = ref<string | null>(null);
  const context = reactive<ThreadRunContextInput>({});
  let referenceId = 0;
  let restoreRequest:
    { parentThreadId: string; promise: Promise<string | null> } | undefined;

  function setContext(next: ThreadRunContextInput) {
    for (const key of Object.keys(context)) {
      Reflect.deleteProperty(context, key);
    }
    Object.assign(context, next);
  }

  async function restoreSidecarThread({ force = false } = {}) {
    const parentThreadId = toValue(options.parentThreadId);
    if (!parentThreadId) return null;
    if (!force && sidecarThreadId.value) return sidecarThreadId.value;
    if (restoreRequest?.parentThreadId === parentThreadId) {
      return restoreRequest.promise;
    }
    const promise = findLatestSidecarThread({ parentThreadId })
      .then((thread) => {
        if (toValue(options.parentThreadId) !== parentThreadId) return null;
        const threadId = thread?.thread_id ?? null;
        if (threadId) sidecarThreadId.value = threadId;
        else if (force) sidecarThreadId.value = null;
        return threadId;
      })
      .catch(() => null)
      .finally(() => {
        if (restoreRequest?.promise === promise) restoreRequest = undefined;
      });
    restoreRequest = { parentThreadId, promise };
    return promise;
  }

  watch(
    () => toValue(options.parentThreadId),
    () => {
      open.value = false;
      activeReferences.value = [];
      conversationQuotes.value = [];
      sidecarThreadId.value = null;
      restoreRequest = undefined;
      setContext({ ...toValue(options.context) });
      void restoreSidecarThread();
    },
    { immediate: true },
  );

  function createReference(nextContext: SidecarContext): SidecarReference {
    referenceId += 1;
    return { id: referenceId, context: nextContext };
  }

  function openContext(nextContext: SidecarContext) {
    const next = getNextSidecarOpenState({
      open: open.value,
      sidecarThreadId: sidecarThreadId.value,
      activeReferences: activeReferences.value,
      nextReference: createReference(nextContext),
    });
    activeReferences.value = next.activeReferences;
    open.value = true;
  }

  function addContextToConversation(nextContext: SidecarContext) {
    conversationQuotes.value = appendSidecarReference(
      conversationQuotes.value,
      createReference(nextContext),
    );
  }

  function fromSelection(
    message: Message,
    selectedText: string,
    displayIndex?: number,
  ) {
    return buildMessageSidecarContext(message, displayIndex, { selectedText });
  }

  function clearConversationQuotes() {
    conversationQuotes.value = [];
  }
  function clearActiveReferences() {
    activeReferences.value = [];
  }
  function close() {
    open.value = false;
  }
  function clearThreadAndClose() {
    clearActiveReferences();
    sidecarThreadId.value = null;
    close();
  }

  return {
    open,
    activeReferences,
    conversationQuotes,
    sidecarThreadId,
    context,
    setContext,
    restoreSidecarThread,
    openContext,
    addContextToConversation,
    fromSelection,
    clearConversationQuotes,
    clearActiveReferences,
    close,
    clearThreadAndClose,
  };
}
