<script setup lang="ts">
import type { ArtifactViewerState } from "../../../core/artifacts/utils";
import ArtifactFileDetail from "./ArtifactFileDetail.vue";
import ArtifactFileList from "./ArtifactFileList.vue";
import ArtifactResizeHandle from "./ArtifactResizeHandle.vue";
import { inject, computed } from "vue";
import { workspacePanelLayoutKey } from "../panel-layout/context";
import type { ArtifactHtmlPreviewIframeRef } from "../../../features/artifacts/preview-artifact/use-artifact-html-preview";

type ArtifactViewMode = "preview" | "code";

const props = defineProps<{
  artifacts: string[];
  artifactCodeCopyMessage: string | null;
  artifactContent: string | null;
  artifactContentError: string | null;
  artifactContentLoading: boolean;
  artifactDetailsVisible: boolean;
  artifactHtmlPreviewErrorMessage: string | null;
  artifactHtmlPreviewIframeRef: ArtifactHtmlPreviewIframeRef;
  artifactHtmlPreviewUrl: string | null;
  artifactPanelDragging?: boolean;
  artifactPanelOpen: boolean;
  artifactSkillInstallError: string | null;
  artifactSkillInstallMessage: string | null;
  artifactViewMode: ArtifactViewMode;
  artifactCopyMessage: string | null;
  canInstallSelectedArtifactSkill: boolean;
  isInstallingArtifactSkill: boolean;
  selectedArtifact: string | null;
  selectedArtifactCanShowCode: boolean;
  selectedArtifactCanToggleView: boolean;
  selectedArtifactCodeLanguage: string;
  selectedArtifactCodeLineCount: number;
  selectedArtifactPreviewContent: string | null;
  selectedArtifactViewer: ArtifactViewerState | null;
  threadId: string;
}>();

const emit = defineEmits<{
  close: [];
  copyArtifactCode: [];
  copyArtifactLink: [];
  installArtifactSkill: [];
  pointerdown: [event: PointerEvent];
  selectArtifact: [artifact: string];
  selectArtifactDetail: [event: Event];
  setViewMode: [mode: ArtifactViewMode];
  toggle: [];
}>();

const { t } = useAppI18n();
const panelLayout = inject(workspacePanelLayoutKey, null);
const artifactPanelDragging = computed(() => panelLayout?.artifactPanelDragging.value ?? props.artifactPanelDragging ?? false);
const artifactPanelOpen = computed(() => panelLayout?.artifactPanelOpen.value ?? props.artifactPanelOpen);
const artifactPanelResizeAxis = computed(() => panelLayout?.artifactPanelResizeAxis.value ?? "horizontal");
const artifactPanelHeight = computed(() => panelLayout?.artifactPanelHeight.value ?? 80);
const artifactPanelWidth = computed(() => panelLayout?.artifactPanelWidth.value ?? 40);
</script>

<template>
  <div class="workspace-artifacts-layout" data-slot="resizable-panel-group" :data-artifact-open="artifactPanelOpen">
    <span class="workspace-artifacts__transition-sentinel" :style="{ flexGrow: artifactPanelOpen ? 1 : 0 }" />
    <button class="workspace-artifacts-trigger" :disabled="props.artifacts.length === 0" data-testid="artifact-trigger" type="button" @click="emit('toggle')">
      {{ t("common.artifacts") }}
    </button>
    <section
      v-show="artifactPanelOpen"
      id="artifacts"
      class="workspace-artifacts"
      :class="{ 'workspace-artifacts--dragging': artifactPanelDragging }"
      :style="{
        height: artifactPanelResizeAxis === 'vertical' ? `${artifactPanelHeight}%` : undefined,
        width: `${artifactPanelWidth}%`,
      }"
      data-panel="artifacts"
      data-testid="vue-artifact-panel"
      v-bind="{ [(['aria', 'hidden'].join('-'))]: !artifactPanelOpen }"
      role="dialog"
    >
      <ArtifactResizeHandle :axis="artifactPanelResizeAxis" :dragging="artifactPanelDragging" :open="artifactPanelOpen" @pointerdown="panelLayout ? panelLayout.beginArtifactResize($event) : emit('pointerdown', $event)" />
      <div class="workspace-artifacts__header">
        <h2>{{ t("common.artifacts") }}</h2>
      </div>
      <div v-if="artifactPanelOpen" id="vue-artifact-panel-body" class="workspace-artifacts__body" data-testid="vue-artifact-panel-body">
        <ArtifactFileList :artifacts="props.artifacts" :selected-artifact="props.selectedArtifact" @select="emit('selectArtifact', $event)" />
        <ArtifactFileDetail
          :artifact-code-copy-message="props.artifactCodeCopyMessage"
          :artifact-content="props.artifactContent"
          :artifact-content-error="props.artifactContentError"
          :artifact-content-loading="props.artifactContentLoading"
          :artifact-copy-message="props.artifactCopyMessage"
          :artifact-details-visible="props.artifactDetailsVisible"
          :artifact-html-preview-error-message="props.artifactHtmlPreviewErrorMessage"
          :artifact-html-preview-iframe-ref="props.artifactHtmlPreviewIframeRef"
          :artifact-html-preview-url="props.artifactHtmlPreviewUrl"
          :artifact-skill-install-error="props.artifactSkillInstallError"
          :artifact-skill-install-message="props.artifactSkillInstallMessage"
          :artifact-view-mode="props.artifactViewMode"
          :artifacts="props.artifacts"
          :can-install-selected-artifact-skill="props.canInstallSelectedArtifactSkill"
          :is-installing-artifact-skill="props.isInstallingArtifactSkill"
          :selected-artifact="props.selectedArtifact"
          :selected-artifact-can-show-code="props.selectedArtifactCanShowCode"
          :selected-artifact-can-toggle-view="props.selectedArtifactCanToggleView"
          :selected-artifact-code-language="props.selectedArtifactCodeLanguage"
          :selected-artifact-code-line-count="props.selectedArtifactCodeLineCount"
          :selected-artifact-preview-content="props.selectedArtifactPreviewContent"
          :selected-artifact-viewer="props.selectedArtifactViewer"
          :thread-id="props.threadId"
          @close="emit('close')"
          @copy-artifact-code="emit('copyArtifactCode')"
          @copy-artifact-link="emit('copyArtifactLink')"
          @install-artifact-skill="emit('installArtifactSkill')"
          @select-artifact-detail="emit('selectArtifactDetail', $event)"
          @set-view-mode="emit('setViewMode', $event)"
        />
      </div>
    </section>
  </div>
</template>
