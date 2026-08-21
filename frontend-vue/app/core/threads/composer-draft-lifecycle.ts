/*
  【文件职责】     按 user/agent/thread 选择器批量清理 tab 级 composer 草稿。
  【对应 frontend/】 core/threads/composer-draft.ts 的生命周期扩展
  【架构位置】     L3 草稿持久化
  【主要导出】     clearComposerDrafts · ComposerDraftSelector
  【依赖关系】     threads/composer-draft
  【边界与注意】   只在已确认 logout/delete 后调用；存储异常不阻断主流程。
*/

import type { ComposerDraftStorage } from "./composer-draft";

const COMPOSER_DRAFT_PREFIX = "deerflow:composer-draft:v1:";

type EnumerableComposerDraftStorage = ComposerDraftStorage &
  Pick<Storage, "key" | "length">;

export interface ComposerDraftSelector {
  userId?: string;
  agentName?: string | null;
  threadId?: string;
}

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function parseComposerDraftKey(key: string) {
  if (!key.startsWith(COMPOSER_DRAFT_PREFIX)) {
    return null;
  }
  const segments = key.slice(COMPOSER_DRAFT_PREFIX.length).split(":");
  if (segments.length !== 3) {
    return null;
  }
  const [rawUserId, rawAgentName, rawThreadId] = segments;
  const userId = decode(rawUserId!);
  const agentName = decode(rawAgentName!);
  const threadId = decode(rawThreadId!);
  if (userId === null || agentName === null || threadId === null) {
    return null;
  }
  return { userId, agentName, threadId };
}

function matchesSelector(
  parsed: NonNullable<ReturnType<typeof parseComposerDraftKey>>,
  selector: ComposerDraftSelector,
) {
  return (
    (selector.userId === undefined || parsed.userId === selector.userId) &&
    (selector.agentName === undefined ||
      parsed.agentName === (selector.agentName ?? "lead-agent")) &&
    (selector.threadId === undefined || parsed.threadId === selector.threadId)
  );
}

/** Clear tab-scoped composer drafts for logout or a confirmed thread delete. */
export function clearComposerDrafts(
  storage: EnumerableComposerDraftStorage | null | undefined,
  selector: ComposerDraftSelector = {},
) {
  try {
    if (!storage) return;
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) continue;
      const parsed = parseComposerDraftKey(key);
      if (parsed && matchesSelector(parsed, selector)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      storage.removeItem(key);
    }
  } catch {
    // Draft cleanup is best effort; auth/logout and deletion must still finish.
  }
}
