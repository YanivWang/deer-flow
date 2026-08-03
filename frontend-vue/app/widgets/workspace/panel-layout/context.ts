import type { ComputedRef, InjectionKey, Ref } from "vue";

export interface WorkspacePanelLayoutContext {
  artifactPanelDragging: Readonly<Ref<boolean>> | ComputedRef<boolean>;
  artifactPanelOpen: Readonly<Ref<boolean>> | ComputedRef<boolean>;
  artifactPanelResizeAxis: Readonly<Ref<"horizontal" | "vertical">> | ComputedRef<"horizontal" | "vertical">;
  artifactPanelHeight: Readonly<Ref<number>> | ComputedRef<number>;
  artifactPanelWidth: Readonly<Ref<number>> | ComputedRef<number>;
  beginArtifactResize: (event: PointerEvent) => void;
}

export const workspacePanelLayoutKey: InjectionKey<WorkspacePanelLayoutContext> = Symbol("workspace-panel-layout");
