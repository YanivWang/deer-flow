/*
  【文件职责】     持有单个 thread 的 artifact 面板、选择、草稿与恢复状态。
  【对应 frontend/】 frontend/src/components/workspace/artifacts/context.tsx
  【架构位置】     L3（DeerFlow artifacts）
  【主要导出】     useArtifactsPanel
  【依赖关系】     core/artifacts · sessionStorage · AgentChat/ArtifactPanel
  【边界与注意】   ThreadState.artifacts 是权威业务列表；sessionStorage 只恢复 UI
                   状态。watch 必须 immediate，且历史 loading 时不能用初始空值覆盖恢复。
*/

import { computed, onBeforeUnmount, reactive, ref, toValue, watch } from "vue";
import type { MaybeRefOrGetter } from "vue";

import type { ArtifactDraftState } from "@/core/artifacts/editing";

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
  const drafts = reactive<Record<string, ArtifactDraftState>>({});
  const editingPath = ref<string | null>(null);
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
      for (const key of Object.keys(drafts)) {
        Reflect.deleteProperty(drafts, key);
      }
      editingPath.value = null;
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
        selectedArtifact.value = null;
      }
    },
    { immediate: true },
  );

  watch([artifacts, selectedArtifact, open, panelSize], persist, {
    deep: true,
  });

  function setOpen(value: boolean) {
    if (!value && autoOpen.value) {
      autoOpen.value = false;
      autoSelect.value = false;
    }
    open.value = value;
  }

  function select(path: string, automatic = false) {
    selectedArtifact.value = path;
    if (!path.startsWith("write-file:") && !artifacts.value.includes(path)) {
      if (!openedPresentedArtifacts.value.includes(path)) {
        openedPresentedArtifacts.value.push(path);
      }
    }
    if (!automatic) autoSelect.value = false;
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  const hasUnsavedDrafts = computed(() =>
    Object.values(drafts).some(
      (draft) => draft.draftContent !== draft.baselineContent,
    ),
  );
  function beforeUnload(event: BeforeUnloadEvent) {
    if (hasUnsavedDrafts.value) event.preventDefault();
  }
  if (import.meta.client)
    globalThis.addEventListener("beforeunload", beforeUnload);
  onBeforeUnmount(() =>
    globalThis.removeEventListener("beforeunload", beforeUnload),
  );

  return {
    artifacts,
    selectedArtifact,
    openedPresentedArtifacts,
    open,
    autoOpen,
    autoSelect,
    panelSize,
    drafts,
    editingPath,
    hasUnsavedDrafts,
    select,
    setOpen,
    close,
  };
}
