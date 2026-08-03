import { ref, toValue, type MaybeRefOrGetter } from "vue";

import { compactThreadContext } from "../../core/api/thread/client";
import type { ThreadCompactResponse } from "../../core/api/thread/types";

export const COMPACT_SKIPPED_MESSAGE = "当前上下文暂时不需要压缩。";
export const COMPACT_BUSY_MESSAGE = "压缩上下文前请先停止当前流。";
export const COMPACT_SUCCESS_MESSAGE = "较早上下文已压缩。";

export function useThreadCompaction({
  agentName,
  canCompact,
  isBusy,
  modelName,
  threadId,
}: {
  agentName?: MaybeRefOrGetter<string | null | undefined>;
  canCompact: MaybeRefOrGetter<boolean>;
  isBusy: MaybeRefOrGetter<boolean>;
  modelName?: MaybeRefOrGetter<string | null | undefined>;
  threadId: MaybeRefOrGetter<string>;
}) {
  const compactErrorMessage = ref<string | null>(null);
  const compactNoticeMessage = ref<string | null>(null);
  const isCompacting = ref(false);

  async function compactThread(): Promise<ThreadCompactResponse | null> {
    compactErrorMessage.value = null;
    compactNoticeMessage.value = null;

    if (!toValue(canCompact)) {
      compactNoticeMessage.value = COMPACT_SKIPPED_MESSAGE;
      return null;
    }

    if (toValue(isBusy)) {
      compactErrorMessage.value = COMPACT_BUSY_MESSAGE;
      return null;
    }

    isCompacting.value = true;
    try {
      const result = await compactThreadContext(toValue(threadId), {
        agentName: toNullableString(agentName),
        modelName: toNullableString(modelName),
      });
      compactNoticeMessage.value = result.compacted
        ? COMPACT_SUCCESS_MESSAGE
        : COMPACT_SKIPPED_MESSAGE;
      return result;
    } catch (error) {
      compactErrorMessage.value =
        error instanceof Error ? error.message : "上下文压缩失败。";
      throw error;
    } finally {
      isCompacting.value = false;
    }
  }

  return {
    compactErrorMessage,
    compactNoticeMessage,
    compactThread,
    isCompacting,
  };
}

function toNullableString(value: MaybeRefOrGetter<string | null | undefined> | undefined) {
  const resolved = value === undefined ? undefined : toValue(value);
  return typeof resolved === "string" && resolved ? resolved : null;
}
