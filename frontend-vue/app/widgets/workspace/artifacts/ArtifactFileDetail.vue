<script setup lang="ts">
import { artifactFilename } from "../../../core/artifacts/utils";
import type { ArtifactViewerState } from "../../../core/artifacts/utils";
import ArtifactPreview from "./ArtifactPreview.vue";
import type { ArtifactHtmlPreviewIframeRef } from "../../../features/artifacts/preview-artifact/use-artifact-html-preview";

type ArtifactViewMode = "preview" | "code";

const props = defineProps<{
  artifactCodeCopyMessage: string | null;
  artifactContent: string | null;
  artifactContentError: string | null;
  artifactContentLoading: boolean;
  artifactCopyMessage: string | null;
  artifactDetailsVisible: boolean;
  artifactHtmlPreviewErrorMessage: string | null;
  artifactHtmlPreviewIframeRef: ArtifactHtmlPreviewIframeRef;
  artifactHtmlPreviewUrl: string | null;
  artifactSkillInstallError: string | null;
  artifactSkillInstallMessage: string | null;
  artifactViewMode: ArtifactViewMode;
  artifacts: string[];
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
  selectArtifactDetail: [event: Event];
  setViewMode: [mode: ArtifactViewMode];
}>();
</script>

<template>
  <section
    v-if="props.artifactDetailsVisible && props.selectedArtifactViewer"
    class="workspace-artifacts__selected"
    data-testid="vue-artifact-selected"
    :data-path="props.selectedArtifact ?? undefined"
  >
    <header class="workspace-artifacts__selected-header">
      <div>
        <strong data-testid="vue-artifact-selected-filename">
          {{ props.selectedArtifactViewer.filename }}
        </strong>
        <label class="workspace-artifacts__selected-picker">
          <span>当前产物</span>
          <select :value="props.selectedArtifact ?? ''" data-testid="vue-artifact-detail-select" @change="emit('selectArtifactDetail', $event)">
            <option v-for="artifact in props.artifacts" :key="artifact" :value="artifact">
              {{ artifactFilename(artifact) }}
            </option>
          </select>
        </label>
      </div>
      <div class="workspace-artifacts__actions">
        <a class="workspace-button workspace-button--ghost" data-testid="vue-artifact-open" :href="props.selectedArtifactViewer.artifactUrl" target="_blank" rel="noopener noreferrer">打开</a>
        <a class="workspace-button" data-testid="vue-artifact-download" :download="props.selectedArtifactViewer.downloadFilename" :href="props.selectedArtifactViewer.downloadUrl" target="_blank" rel="noopener noreferrer">下载</a>
        <button class="workspace-button" data-testid="vue-artifact-copy" type="button" @click="emit('copyArtifactLink')">复制链接</button>
        <button class="workspace-button workspace-button--ghost" data-testid="vue-artifact-close" type="button" @click="emit('close')">关闭</button>
        <button v-if="props.canInstallSelectedArtifactSkill" class="workspace-button" data-testid="vue-artifact-install-skill" type="button" :disabled="props.isInstallingArtifactSkill" @click="emit('installArtifactSkill')">
          {{ props.isInstallingArtifactSkill ? "正在安装..." : "安装技能" }}
        </button>
      </div>
    </header>
    <p v-if="props.artifactCopyMessage" class="workspace-artifacts__copy-status" data-testid="vue-artifact-copy-status" role="status">{{ props.artifactCopyMessage }}</p>
    <p v-if="props.artifactSkillInstallMessage" class="workspace-artifacts__copy-status" data-testid="vue-artifact-install-skill-status" role="status">{{ props.artifactSkillInstallMessage }}</p>
    <a-alert v-if="props.artifactSkillInstallError" data-testid="vue-artifact-install-skill-error" role="alert" type="error" show-icon :message="props.artifactSkillInstallError" />
    <ArtifactPreview
      :artifact-code-copy-message="props.artifactCodeCopyMessage"
      :artifact-content="props.artifactContent"
      :artifact-content-error="props.artifactContentError"
      :artifact-content-loading="props.artifactContentLoading"
      :artifact-html-preview-error-message="props.artifactHtmlPreviewErrorMessage"
      :artifact-html-preview-iframe-ref="props.artifactHtmlPreviewIframeRef"
      :artifact-html-preview-url="props.artifactHtmlPreviewUrl"
      :artifact-view-mode="props.artifactViewMode"
      :artifacts="props.artifacts"
      :selected-artifact-can-show-code="props.selectedArtifactCanShowCode"
      :selected-artifact-can-toggle-view="props.selectedArtifactCanToggleView"
      :selected-artifact-code-language="props.selectedArtifactCodeLanguage"
      :selected-artifact-code-line-count="props.selectedArtifactCodeLineCount"
      :selected-artifact-preview-content="props.selectedArtifactPreviewContent"
      :selected-artifact-viewer="props.selectedArtifactViewer"
      :thread-id="props.threadId"
      @copy-artifact-code="emit('copyArtifactCode')"
      @set-view-mode="emit('setViewMode', $event)"
    />
  </section>
</template>
