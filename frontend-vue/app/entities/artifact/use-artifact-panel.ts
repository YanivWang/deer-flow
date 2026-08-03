import { computed, nextTick, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";

type ArtifactPanelState = {
  artifacts: string[];
  open: boolean;
  selectedArtifact: string | null;
};

type ArtifactPanelStorage = Pick<Storage, "getItem" | "setItem">;

export const ARTIFACT_PANEL_STORAGE_PREFIX = "deerflow:artifacts:v1";

export function artifactPanelStorageKey(pathname: string): string {
  return `${ARTIFACT_PANEL_STORAGE_PREFIX}:${encodeURIComponent(pathname)}`;
}

export function useArtifactPanel(
  pathname: MaybeRefOrGetter<string>,
  discoveredArtifacts: MaybeRefOrGetter<readonly unknown[]> = [],
  options: {
    autoOpen?: MaybeRefOrGetter<boolean>;
    storage?: ArtifactPanelStorage | null;
  } = {},
) {
  const storage = options.storage ?? readSessionStorage();
  const artifacts = ref<string[]>([]);
  const open = ref(false);
  const selectedArtifact = ref<string | null>(null);
  const hydratedPath = ref<string | null>(null);
  const autoOpenInitialized = ref(false);
  const shouldAutoOpen = computed(() => Boolean(toValue(options.autoOpen ?? false)));

  const normalizedDiscoveredArtifacts = computed(() =>
    uniqueStrings(toValue(discoveredArtifacts)),
  );

  watch(
    () => toValue(pathname),
    (nextPathname) => {
      autoOpenInitialized.value = false;
      hydratePath(nextPathname, storage, { artifacts, open, selectedArtifact, hydratedPath });
      syncArtifacts(normalizedDiscoveredArtifacts.value, {
        artifacts,
        open,
        selectedArtifact,
      });
    },
    { immediate: true },
  );

  watch(
    [normalizedDiscoveredArtifacts, shouldAutoOpen],
    ([nextArtifacts, nextShouldAutoOpen], [previousArtifacts] = [[], false]) => {
      syncArtifacts(nextArtifacts, { artifacts, open, selectedArtifact });
      if (
        autoOpenInitialized.value
        && nextShouldAutoOpen
        && nextArtifacts.length > (previousArtifacts?.length ?? 0)
        && nextArtifacts.length > 0
      ) {
        open.value = true;
      }
      autoOpenInitialized.value = true;
    },
    { immediate: true },
  );

  watch(
    [artifacts, open, selectedArtifact],
    () => {
      persistPath(toValue(pathname), storage, { artifacts, open, selectedArtifact, hydratedPath });
    },
    { deep: true },
  );

  function selectArtifact(artifact: string, options: { openPanel?: boolean } = {}) {
    const nextArtifacts = artifacts.value.includes(artifact)
      ? artifacts.value
      : [...artifacts.value, artifact];
    artifacts.value = nextArtifacts;
    selectedArtifact.value = artifact;
    if (options.openPanel ?? true) {
      open.value = true;
    }
  }

  function deselectArtifact() {
    selectedArtifact.value = null;
    open.value = false;
  }

  function setOpen(nextOpen: boolean) {
    open.value = nextOpen;
  }

  return {
    artifacts,
    deselectArtifact,
    open,
    selectedArtifact,
    selectArtifact,
    setOpen,
  };
}

function hydratePath(
  pathname: string,
  storage: ArtifactPanelStorage | null,
  state: {
    artifacts: Ref<string[]>;
    hydratedPath: Ref<string | null>;
    open: Ref<boolean>;
    selectedArtifact: Ref<string | null>;
  },
) {
  const persisted = readPersistedState(pathname, storage);
  state.artifacts.value = persisted?.artifacts ?? [];
  state.open.value = persisted?.open ?? false;
  state.selectedArtifact.value = persisted?.selectedArtifact ?? null;
  state.hydratedPath.value = pathname;
}

function syncArtifacts(
  nextArtifacts: string[],
  state: {
    artifacts: Ref<string[]>;
    open: Ref<boolean>;
    selectedArtifact: Ref<string | null>;
  },
) {
  if (nextArtifacts.length === 0) {
    return;
  }

  const selected = state.selectedArtifact.value;
  state.artifacts.value = selected && !nextArtifacts.includes(selected)
    ? [selected, ...nextArtifacts]
    : nextArtifacts;
  if (!selected) {
    state.selectedArtifact.value = nextArtifacts[0] ?? null;
  }
}

function persistPath(
  pathname: string,
  storage: ArtifactPanelStorage | null,
  state: {
    artifacts: Ref<string[]>;
    hydratedPath: Ref<string | null>;
    open: Ref<boolean>;
    selectedArtifact: Ref<string | null>;
  },
) {
  if (!storage || state.hydratedPath.value !== pathname) {
    return;
  }

  try {
    storage.setItem(
      artifactPanelStorageKey(pathname),
      JSON.stringify({
        artifacts: state.artifacts.value,
        open: state.open.value,
        selectedArtifact: state.selectedArtifact.value,
      } satisfies ArtifactPanelState),
    );
  } catch {
    // Browser storage can be disabled or full; the panel remains usable in memory.
  }
}

function readPersistedState(
  pathname: string,
  storage: ArtifactPanelStorage | null,
): ArtifactPanelState | null {
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(artifactPanelStorageKey(pathname));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ArtifactPanelState>;
    if (
      !Array.isArray(parsed.artifacts) ||
      !parsed.artifacts.every((artifact) => typeof artifact === "string") ||
      typeof parsed.open !== "boolean" ||
      !(
        parsed.selectedArtifact === null ||
        typeof parsed.selectedArtifact === "string"
      )
    ) {
      return null;
    }
    return {
      artifacts: parsed.artifacts,
      open: parsed.open,
      selectedArtifact: parsed.selectedArtifact,
    };
  } catch {
    return null;
  }
}

function readSessionStorage(): ArtifactPanelStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage;
}

function uniqueStrings(values: readonly unknown[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string")));
}

export async function flushArtifactPanelPersistence() {
  await nextTick();
}
