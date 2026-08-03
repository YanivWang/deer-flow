import { computed, onBeforeUnmount, onMounted, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";
import {
  ARTIFACT_PANEL_COLLAPSE_THRESHOLD,
  ARTIFACT_PANEL_DEFAULT_HEIGHT,
  ARTIFACT_PANEL_DEFAULT_WIDTH,
  clampArtifactPanelHeight,
  clampArtifactPanelWidth,
  isRestorableArtifactWidth,
  isValidArtifactPanelSnapshot,
  resolveArtifactResizeAxis,
  type ArtifactResizeAxis,
} from "./model";

type ResizeOptions = {
  artifactOpen: MaybeRefOrGetter<boolean>;
  onOpenChange: (open: boolean) => void;
  storageKey: MaybeRefOrGetter<string>;
};

function isMobileViewport(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 840px)").matches;
}

export function useResizeArtifactPanel(options: ResizeOptions) {
  const dragging = ref(false);
  const axis = ref<ArtifactResizeAxis>(resolveArtifactResizeAxis(isMobileViewport()));
  const width = ref(ARTIFACT_PANEL_DEFAULT_WIDTH);
  const height = ref(ARTIFACT_PANEL_DEFAULT_HEIGHT);
  const restoreWidth = ref(ARTIFACT_PANEL_DEFAULT_WIDTH);
  const restoreHeight = ref(ARTIFACT_PANEL_DEFAULT_HEIGHT);
  const dragStartX = ref(0);
  const dragStartY = ref(0);
  const dragStartWidth = ref(width.value);
  const dragStartHeight = ref(height.value);
  let resizeGroup: HTMLElement | null = null;
  let persistFrame: number | null = null;

  const layoutStyle = computed(() => ({
    "--workspace-artifact-height": `${height.value}%`,
    "--workspace-artifact-width": `${width.value}%`,
  }));

  function restorePersistedLayout(): void {
    const storageKey = toValue(options.storageKey);
    if (!storageKey || typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!isValidArtifactPanelSnapshot(parsed)) return;
      const saved = parsed as Partial<{
        width: number;
        height: number;
        restoreWidth: number;
        restoreHeight: number;
      }>;
      if (typeof saved.width === "number") width.value = clampArtifactPanelWidth(saved.width);
      if (typeof saved.height === "number") height.value = clampArtifactPanelHeight(saved.height);
      if (typeof saved.restoreWidth === "number" && isRestorableArtifactWidth(saved.restoreWidth)) {
        restoreWidth.value = saved.restoreWidth;
      }
      if (typeof saved.restoreHeight === "number") {
        restoreHeight.value = clampArtifactPanelHeight(saved.restoreHeight);
      }
    } catch {
      return;
    }
  }

  function persistLayout(): void {
    const storageKey = toValue(options.storageKey);
    if (!storageKey || typeof window === "undefined" || persistFrame !== null) return;
    persistFrame = window.requestAnimationFrame(() => {
      persistFrame = null;
      try {
        const snapshot = {
          height: height.value,
          restoreHeight: restoreHeight.value,
          restoreWidth: restoreWidth.value,
          width: width.value,
        };
        window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
      } catch {
        return;
      }
    });
  }

  function updateAxis(): void {
    if (!dragging.value) axis.value = resolveArtifactResizeAxis(isMobileViewport());
  }

  function beginResize(event: PointerEvent): void {
    const target = event.currentTarget;
    const group = target instanceof HTMLElement
      ? target.closest("[data-slot='resizable-panel-group']")
      : null;
    if (!(group instanceof HTMLElement)) return;

    resizeGroup = group;
    dragging.value = true;
    dragStartX.value = event.clientX;
    dragStartY.value = event.clientY;
    dragStartWidth.value = width.value;
    dragStartHeight.value = height.value;
    updateAxis();
    group.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", endResize, { once: true });
    window.addEventListener("pointercancel", endResize, { once: true });
  }

  function resize(event: PointerEvent): void {
    if (!dragging.value || !resizeGroup) return;
    if (axis.value === "vertical") {
      if (resizeGroup.clientHeight === 0) return;
      const delta = ((dragStartY.value - event.clientY) / resizeGroup.clientHeight) * 100;
      height.value = clampArtifactPanelHeight(dragStartHeight.value + delta);
      restoreHeight.value = height.value;
      persistLayout();
      return;
    }
    if (resizeGroup.clientWidth === 0) return;
    const delta = ((dragStartX.value - event.clientX) / resizeGroup.clientWidth) * 100;
    width.value = clampArtifactPanelWidth(dragStartWidth.value + delta);
    options.onOpenChange(width.value > ARTIFACT_PANEL_COLLAPSE_THRESHOLD);
    persistLayout();
  }

  function endResize(): void {
    dragging.value = false;
    if (axis.value === "horizontal" && isRestorableArtifactWidth(width.value)) {
      restoreWidth.value = width.value;
    }
    persistLayout();
    resizeGroup = null;
    if (typeof window !== "undefined") {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointercancel", endResize);
    }
  }

  function restoreOpenPanel(): void {
    if (width.value <= ARTIFACT_PANEL_COLLAPSE_THRESHOLD) {
      width.value = restoreWidth.value;
    }
  }

  watch(() => toValue(options.artifactOpen), (open) => {
    if (open) restoreOpenPanel();
  });

  onMounted(() => {
    restorePersistedLayout();
    updateAxis();
    window.addEventListener("resize", updateAxis);
  });

  onBeforeUnmount(() => {
    endResize();
    if (persistFrame !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(persistFrame);
      persistFrame = null;
    }
    window.removeEventListener("resize", updateAxis);
  });

  return {
    artifactPanelHeight: height as Readonly<Ref<number>>,
    artifactPanelResizeAxis: axis as Readonly<Ref<ArtifactResizeAxis>>,
    artifactPanelWidth: width as Readonly<Ref<number>>,
    artifactRestoreHeight: restoreHeight as Readonly<Ref<number>>,
    artifactRestoreWidth: restoreWidth as Readonly<Ref<number>>,
    beginArtifactResize: beginResize,
    dragging: dragging as Readonly<Ref<boolean>>,
    layoutStyle,
  };
}

export type ResizeArtifactPanelController = ReturnType<typeof useResizeArtifactPanel>;
