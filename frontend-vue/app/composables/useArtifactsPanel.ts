/*
  【文件职责】     持有单个 thread 的 artifact 面板、选择、草稿与恢复状态。
  【架构位置】     L3（DeerFlow artifacts）
  【主要导出】     useArtifactsPanel
  【依赖关系】     core/artifacts · sessionStorage · AgentChat/ArtifactPanel
  【边界与注意】   ThreadState.artifacts 是权威业务列表；sessionStorage 只恢复 UI
                   状态。watch 必须 immediate，且历史 loading 时不能用初始空值覆盖恢复。
*/

import { ref, toValue, watch } from "vue";
import type { MaybeRefOrGetter } from "vue";

import { useArtifactDraft } from "@/composables/useArtifactDraft";

const STORAGE_PREFIX = "deerflow:artifacts:v1";

type PersistedState = {
  artifacts: string[];
  openedPresentedArtifacts: string[];
  selectedArtifact: string | null;
  open: boolean;
  panelSize: number;
};

function storageKey(threadId: string) {
  return `${STORAGE_PREFIX}:${encodeURIComponent(`/workspace/chats/${threadId}`)}`;
}

function readPersisted(threadId: string): PersistedState | null {
  if (!import.meta.client) return null;
  try {
    const value = JSON.parse(
      sessionStorage.getItem(storageKey(threadId)) ?? "null",
    ) as Partial<PersistedState> | null;
    if (
      !value ||
      !Array.isArray(value.artifacts) ||
      !value.artifacts.every((path) => typeof path === "string") ||
      !(
        value.selectedArtifact === null ||
        typeof value.selectedArtifact === "string"
      ) ||
      typeof value.open !== "boolean"
    ) {
      return null;
    }
    return {
      artifacts: value.artifacts,
      openedPresentedArtifacts: Array.isArray(value.openedPresentedArtifacts)
        ? value.openedPresentedArtifacts.filter(
            (path): path is string => typeof path === "string",
          )
        : value.selectedArtifact &&
            !value.artifacts.includes(value.selectedArtifact)
          ? [value.selectedArtifact]
          : [],
      selectedArtifact: value.selectedArtifact,
      open: value.open,
      panelSize:
        typeof value.panelSize === "number" && value.panelSize > 0
          ? value.panelSize
          : 40,
    };
  } catch {
    return null;
  }
}

export function useArtifactsPanel(options: {
  threadId: MaybeRefOrGetter<string | null>;
  authoritativeArtifacts: MaybeRefOrGetter<readonly string[] | undefined>;
  historyLoading: MaybeRefOrGetter<boolean>;
}) {
  const artifacts = ref<string[]>([]);
  const selectedArtifact = ref<string | null>(null);
  const open = ref(false);
  const autoOpen = ref(true);
  const autoSelect = ref(true);
  const panelSize = ref(40);
  const openedPresentedArtifacts = ref<string[]>([]);
  const draftOwner = useArtifactDraft();
  const hydratedThreadId = ref<string | null>(null);

  function persist() {
    const threadId = toValue(options.threadId);
    if (!import.meta.client || !threadId || hydratedThreadId.value !== threadId)
      return;
    try {
      sessionStorage.setItem(
        storageKey(threadId),
        JSON.stringify({
          artifacts: artifacts.value,
          openedPresentedArtifacts: openedPresentedArtifacts.value,
          selectedArtifact: selectedArtifact.value,
          open: open.value,
          panelSize: panelSize.value,
        } satisfies PersistedState),
      );
    } catch {
      // Storage is optional; the in-memory panel remains functional.
    }
  }

  watch(
    () => toValue(options.threadId),
    (threadId) => {
      draftOwner.reset();
      openedPresentedArtifacts.value = [];
      autoOpen.value = true;
      if (!threadId) {
        artifacts.value = [];
        selectedArtifact.value = null;
        open.value = false;
        hydratedThreadId.value = null;
        return;
      }
      const persisted = readPersisted(threadId);
      artifacts.value = persisted?.artifacts ?? [];
      openedPresentedArtifacts.value =
        persisted?.openedPresentedArtifacts ?? [];
      selectedArtifact.value = persisted?.selectedArtifact ?? null;
      open.value = persisted?.open ?? false;
      panelSize.value = persisted?.panelSize ?? 40;
      autoSelect.value = !persisted?.selectedArtifact;
      hydratedThreadId.value = threadId;
    },
    { immediate: true },
  );

  watch(
    [
      () => toValue(options.authoritativeArtifacts),
      () => toValue(options.historyLoading),
    ],
    ([authoritative, loading]) => {
      if (loading || authoritative === undefined) return;
      artifacts.value = [...authoritative];
      if (
        selectedArtifact.value &&
        !selectedArtifact.value.startsWith("write-file:") &&
        !artifacts.value.includes(selectedArtifact.value) &&
        !openedPresentedArtifacts.value.includes(selectedArtifact.value)
      ) {
        if (draftOwner.hasUnsavedDrafts.value) {
          if (
            !openedPresentedArtifacts.value.includes(selectedArtifact.value)
          ) {
            openedPresentedArtifacts.value.push(selectedArtifact.value);
          }
        } else {
          selectedArtifact.value = null;
        }
      }
    },
    { immediate: true },
  );

  watch([artifacts, selectedArtifact, open, panelSize], persist, {
    deep: true,
  });

  function setOpen(value: boolean) {
    if (
      !value &&
      selectedArtifact.value &&
      !draftOwner.requestLeave(selectedArtifact.value)
    ) {
      return false;
    }
    if (!value && autoOpen.value) {
      autoOpen.value = false;
      autoSelect.value = false;
    }
    open.value = value;
    return true;
  }

  function select(path: string, automatic = false) {
    if (automatic && !autoSelect.value) return false;
    if (
      selectedArtifact.value &&
      selectedArtifact.value !== path &&
      !draftOwner.requestLeave(selectedArtifact.value)
    ) {
      return false;
    }
    selectedArtifact.value = path;
    if (!path.startsWith("write-file:") && !artifacts.value.includes(path)) {
      if (!openedPresentedArtifacts.value.includes(path)) {
        openedPresentedArtifacts.value.push(path);
      }
    }
    if (!automatic) autoSelect.value = false;
    if (!automatic || autoOpen.value) setOpen(true);
    return true;
  }

  function close() {
    return setOpen(false);
  }

  return {
    artifacts,
    selectedArtifact,
    openedPresentedArtifacts,
    open,
    autoOpen,
    autoSelect,
    panelSize,
    draftOwner,
    hasUnsavedDrafts: draftOwner.hasUnsavedDrafts,
    select,
    setOpen,
    close,
  };
}
