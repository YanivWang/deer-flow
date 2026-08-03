<script setup lang="ts">
import { computed, provide, toRef } from "vue";
import type { WorkspacePanelLayoutContext } from "./context";
import { workspacePanelLayoutKey } from "./context";
import { usePanelLayout } from "./use-panel-layout";

const props = withDefaults(defineProps<{
  artifactOpen: boolean;
  browserOpen?: boolean;
  sidecarOpen: boolean;
  storageKey?: string;
}>(), {
  browserOpen: false,
  storageKey: "",
});

const emit = defineEmits<{
  updateArtifactOpen: [open: boolean];
}>();

const panelLayout = usePanelLayout({
  artifactOpen: toRef(props, "artifactOpen"),
  onArtifactOpenChange: (open) => emit("updateArtifactOpen", open),
  storageKey: toRef(props, "storageKey"),
});
const {
  artifactPanelDragging,
} = panelLayout;
const layoutStyle = computed(() => panelLayout.layoutStyle.value);

const context: WorkspacePanelLayoutContext = {
  artifactPanelDragging: panelLayout.artifactPanelDragging,
  artifactPanelHeight: panelLayout.artifactPanelHeight,
  artifactPanelOpen: panelLayout.artifactPanelOpen,
  artifactPanelResizeAxis: panelLayout.artifactPanelResizeAxis,
  artifactPanelWidth: panelLayout.artifactPanelWidth,
  beginArtifactResize: panelLayout.beginArtifactResize,
};
provide(workspacePanelLayoutKey, context);
</script>

<template>
  <div
    class="workspace-panel-layout"
    data-panel-layout-owner="workspace-panel-layout"
    :data-artifact-open="props.artifactOpen"
    :data-artifact-dragging="artifactPanelDragging"
    :data-browser-open="props.browserOpen"
    :data-sidecar-open="props.sidecarOpen"
    :style="layoutStyle"
  >
    <slot />
  </div>
</template>
