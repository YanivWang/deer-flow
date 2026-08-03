import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useResizeArtifactPanel } from "../../../features/artifacts/resize-artifact-panel/use-resize-artifact-panel";

type PanelLayoutOptions = {
  artifactOpen: MaybeRefOrGetter<boolean>;
  onArtifactOpenChange: (open: boolean) => void;
  storageKey: MaybeRefOrGetter<string>;
};

export function usePanelLayout(options: PanelLayoutOptions) {
  const resize = useResizeArtifactPanel({
    artifactOpen: options.artifactOpen,
    onOpenChange: options.onArtifactOpenChange,
    storageKey: options.storageKey,
  });

  return {
    artifactPanelDragging: resize.dragging,
    artifactPanelHeight: resize.artifactPanelHeight,
    artifactPanelOpen: computed(() => toValue(options.artifactOpen)),
    artifactPanelResizeAxis: resize.artifactPanelResizeAxis,
    artifactPanelWidth: resize.artifactPanelWidth,
    beginArtifactResize: resize.beginArtifactResize,
    layoutStyle: resize.layoutStyle,
  };
}

export type PanelLayoutController = ReturnType<typeof usePanelLayout>;
