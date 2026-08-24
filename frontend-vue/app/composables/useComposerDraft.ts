/*
  【文件职责】     集中管理 composer 草稿 key、延迟恢复、保存与 accepted 清理。
  【架构位置】     L3 Vue 状态适配
  【主要导出】     useComposerDraft
  【依赖关系】     core/threads/composer-draft
  【边界与注意】   skill catalog ready 前不恢复；用户先输入时不得被迟到恢复覆盖。
*/

import {
  computed,
  nextTick,
  onScopeDispose,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

import {
  buildComposerDraftKey,
  clearComposerDraft,
  getSessionComposerDraftStorage,
  readComposerDraft,
  resolveComposerDraft,
  writeComposerDraft,
} from "@/core/threads/composer-draft";

export function useComposerDraft(options: {
  userId: MaybeRefOrGetter<string | null | undefined>;
  agentName: MaybeRefOrGetter<string | null | undefined>;
  threadId: MaybeRefOrGetter<string>;
  ready: MaybeRefOrGetter<boolean>;
  enabledSkillNames: MaybeRefOrGetter<ReadonlySet<string>>;
  text: Ref<string>;
  skillName: Ref<string | null>;
}) {
  const storage = getSessionComposerDraftStorage();
  const key = computed(() =>
    buildComposerDraftKey({
      userId: toValue(options.userId) || "anonymous",
      agentName: toValue(options.agentName),
      threadId: toValue(options.threadId),
    }),
  );
  let activeKey = key.value;
  let restored = false;
  let applying = false;
  let dirtyBeforeRestore = false;
  let pendingSubmission: {
    key: string;
    text: string;
    skillName: string | null;
  } | null = null;

  function matchesCurrent(snapshot: NonNullable<typeof pendingSubmission>) {
    return (
      snapshot.key === key.value &&
      snapshot.text === options.text.value &&
      snapshot.skillName === options.skillName.value
    );
  }

  function flush(optionsForFlush: { restorePending?: boolean } = {}) {
    if (!restored || applying) return;
    if (pendingSubmission?.key === activeKey) {
      if (matchesCurrent(pendingSubmission)) {
        if (optionsForFlush.restorePending) {
          writeComposerDraft(storage, pendingSubmission.key, {
            text: pendingSubmission.text,
            skillName: pendingSubmission.skillName,
          });
          pendingSubmission = null;
        }
        return;
      }
      pendingSubmission = null;
    }
    writeComposerDraft(storage, activeKey, {
      text: options.text.value,
      skillName: options.skillName.value,
    });
  }

  async function restore() {
    if (!toValue(options.ready)) return;
    if (dirtyBeforeRestore) {
      activeKey = key.value;
      restored = true;
      flush();
      return;
    }
    applying = true;
    activeKey = key.value;
    const raw = readComposerDraft(storage, activeKey);
    const draft = raw
      ? resolveComposerDraft(raw, toValue(options.enabledSkillNames))
      : null;
    options.text.value = draft?.text ?? "";
    options.skillName.value = draft?.skillName ?? null;
    await nextTick();
    applying = false;
    restored = true;
    flush();
  }

  watch(key, () => {
    flush({ restorePending: true });
    restored = false;
    dirtyBeforeRestore = false;
    void restore();
  });
  watch(
    () => toValue(options.ready),
    (ready) => {
      if (ready && !restored) void restore();
    },
    { immediate: true },
  );
  watch([options.text, options.skillName], () => {
    if (!restored && !applying) {
      dirtyBeforeRestore = true;
      return;
    }
    flush();
  });

  function clearIfUnchanged(snapshot: {
    key: string;
    text: string;
    skillName: string | null;
  }) {
    if (!matchesCurrent(snapshot)) {
      return false;
    }
    if (pendingSubmission?.key === snapshot.key) pendingSubmission = null;
    clearComposerDraft(storage, snapshot.key);
    applying = true;
    options.text.value = "";
    options.skillName.value = null;
    applying = false;
    return true;
  }

  function beginSubmission(snapshot: {
    key: string;
    text: string;
    skillName: string | null;
  }) {
    if (!matchesCurrent(snapshot)) return false;
    pendingSubmission = { ...snapshot };
    clearComposerDraft(storage, snapshot.key);
    return true;
  }

  function cancelSubmission(snapshot: {
    key: string;
    text: string;
    skillName: string | null;
  }) {
    if (pendingSubmission?.key !== snapshot.key) return;
    pendingSubmission = null;
    if (snapshot.key === key.value) {
      writeComposerDraft(storage, snapshot.key, {
        text: options.text.value,
        skillName: options.skillName.value,
      });
      return;
    }
    writeComposerDraft(storage, snapshot.key, {
      text: snapshot.text,
      skillName: snapshot.skillName,
    });
  }

  const restorePendingSubmission = () => {
    if (pendingSubmission) flush({ restorePending: true });
  };
  // Ordinary edits are persisted synchronously by the value watcher. Only an
  // accepted-pending submission needs an unload fallback because beginSubmission
  // intentionally removed its stored copy. This also respects an explicit
  // sessionStorage.clear() instead of recreating a normal draft during reload.
  const pageHide = () => restorePendingSubmission();
  globalThis.addEventListener?.("pagehide", pageHide);
  onScopeDispose(() => {
    restorePendingSubmission();
    globalThis.removeEventListener?.("pagehide", pageHide);
  });

  return {
    key,
    flush,
    restore,
    beginSubmission,
    cancelSubmission,
    clearIfUnchanged,
  };
}
