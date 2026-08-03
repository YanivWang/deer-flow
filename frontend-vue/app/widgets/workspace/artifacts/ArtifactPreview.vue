<script setup lang="ts">
import type { ArtifactViewerState } from "../../../core/artifacts/utils";
import type { ArtifactHtmlPreviewIframeRef } from "../../../features/artifacts/preview-artifact/use-artifact-html-preview";
import ArtifactCodeViewer from "./ArtifactCodeViewer.vue";
import MessageContentRenderer from "../messages/MessageContentRenderer.vue";
import { ref, watch } from "vue";

type ArtifactViewMode = "preview" | "code";

const props = defineProps<{
  artifactCodeCopyMessage: string | null;
  artifactContent: string | null;
  artifactContentError: string | null;
  artifactContentLoading: boolean;
  artifactHtmlPreviewErrorMessage: string | null;
  artifactHtmlPreviewIframeRef: ArtifactHtmlPreviewIframeRef;
  artifactHtmlPreviewUrl: string | null;
  artifactViewMode: ArtifactViewMode;
  artifacts: string[];
  selectedArtifactCanShowCode: boolean;
  selectedArtifactCanToggleView: boolean;
  selectedArtifactCodeLanguage: string;
  selectedArtifactCodeLineCount: number;
  selectedArtifactPreviewContent: string | null;
  selectedArtifactViewer: ArtifactViewerState;
  threadId: string;
}>();

const emit = defineEmits<{
  copyArtifactCode: [];
  setViewMode: [mode: ArtifactViewMode];
}>();

const mediaLoadError = ref<string | null>(null);
watch(
  () => [props.selectedArtifactViewer.artifactUrl, props.selectedArtifactViewer.previewKind],
  () => {
    mediaLoadError.value = null;
  },
);

function handleMediaLoadError(): void {
  mediaLoadError.value = `无法加载 ${props.selectedArtifactViewer.filename}。请打开或下载此产物重试。`;
}
</script>

<template>
  <div v-if="props.selectedArtifactCanToggleView" class="workspace-artifacts__view-toggle" data-testid="vue-artifact-view-toggle">
    <button
      type="button"
      class="workspace-button"
      :class="{ 'workspace-button--active': props.artifactViewMode === 'preview' }"
      data-testid="vue-artifact-view-preview"
      @click="emit('setViewMode', 'preview')"
    >预览</button>
    <button
      type="button"
      class="workspace-button"
      :class="{ 'workspace-button--active': props.artifactViewMode === 'code' }"
      data-testid="vue-artifact-view-code"
      @click="emit('setViewMode', 'code')"
    >源码</button>
  </div>
  <div v-if="props.selectedArtifactViewer.canPreview" class="workspace-artifacts__preview" data-testid="vue-artifact-preview">
    <img
      v-if="props.artifactViewMode === 'preview' && props.selectedArtifactViewer.previewKind === 'image'"
      :alt="props.selectedArtifactViewer.filename"
      :src="props.selectedArtifactViewer.artifactUrl"
      @error="handleMediaLoadError"
      @load="mediaLoadError = null"
    >
    <audio
      v-else-if="props.artifactViewMode === 'preview' && props.selectedArtifactViewer.previewKind === 'audio'"
      controls
      preload="metadata"
      :src="props.selectedArtifactViewer.artifactUrl"
      @error="handleMediaLoadError"
      @loadeddata="mediaLoadError = null"
    />
    <video
      v-else-if="props.artifactViewMode === 'preview' && props.selectedArtifactViewer.previewKind === 'video'"
      controls
      playsinline
      preload="metadata"
      :src="props.selectedArtifactViewer.artifactUrl"
      @error="handleMediaLoadError"
      @loadeddata="mediaLoadError = null"
    />
    <iframe
      v-else-if="props.artifactViewMode === 'preview' && props.selectedArtifactViewer.previewKind === 'iframe'"
      sandbox=""
      :src="props.selectedArtifactViewer.artifactUrl"
    />
    <iframe
      v-else-if="props.artifactViewMode === 'preview' && props.selectedArtifactViewer.previewKind === 'html' && props.artifactHtmlPreviewUrl"
      :ref="props.artifactHtmlPreviewIframeRef"
      data-testid="vue-artifact-html-blob-preview"
      title="Artifact preview"
      sandbox="allow-scripts allow-forms"
      :src="props.artifactHtmlPreviewUrl"
    />
    <div v-else-if="props.artifactViewMode === 'preview' && props.selectedArtifactViewer.previewKind === 'markdown'" class="workspace-artifacts__markdown-preview" data-testid="vue-artifact-markdown-preview">
      <MessageContentRenderer
        v-if="props.selectedArtifactPreviewContent !== null"
        :artifact-paths="props.artifacts"
        :content="props.selectedArtifactPreviewContent"
        :thread-id="props.threadId"
      />
      <span v-else-if="props.artifactContentLoading" data-testid="vue-artifact-markdown-loading">正在加载 {{ props.selectedArtifactViewer.filename }}...</span>
      <span v-else-if="props.artifactContentError" data-testid="vue-artifact-markdown-error">{{ props.artifactContentError }}</span>
    </div>
    <span v-else-if="props.artifactViewMode === 'preview' && props.selectedArtifactViewer.previewKind === 'html' && props.artifactContentLoading" data-testid="vue-artifact-html-loading">正在加载 {{ props.selectedArtifactViewer.filename }}...</span>
    <span v-else-if="props.artifactViewMode === 'preview' && props.selectedArtifactViewer.previewKind === 'html' && (props.artifactHtmlPreviewErrorMessage || props.artifactContentError)" data-testid="vue-artifact-html-error">{{ props.artifactHtmlPreviewErrorMessage || props.artifactContentError }}</span>
    <div v-if="mediaLoadError" class="workspace-artifacts__media-error" data-testid="vue-artifact-media-error" role="alert">
      {{ mediaLoadError }}
    </div>
    <p v-if="props.artifactViewMode === 'preview' && props.selectedArtifactViewer.previewKind !== 'code'" class="workspace-artifacts__preview-note" data-testid="vue-artifact-preview-description">
      {{ props.selectedArtifactViewer.previewDescription }}
    </p>
    <div v-if="props.artifactViewMode === 'preview' && props.selectedArtifactViewer.previewKind !== 'code'" class="workspace-artifacts__preview-fallback" data-testid="vue-artifact-preview-fallback">
      <strong>{{ props.selectedArtifactViewer.extensionLabel }} 兜底</strong>
      <span>{{ props.selectedArtifactViewer.fallbackDescription }}</span>
    </div>
    <div v-else-if="props.artifactViewMode === 'code' && props.selectedArtifactCanShowCode" class="workspace-artifacts__code-viewer" data-testid="vue-artifact-code-viewer">
      <header class="workspace-artifacts__code-header">
        <strong>{{ props.selectedArtifactViewer.filename }}</strong>
        <span data-testid="vue-artifact-code-language">{{ props.selectedArtifactCodeLanguage }}</span>
        <small v-if="props.selectedArtifactCodeLineCount > 0" data-testid="vue-artifact-code-line-count">{{ props.selectedArtifactCodeLineCount }} 行</small>
        <button class="workspace-button" type="button" :disabled="props.artifactContent === null" data-testid="vue-artifact-copy-code" @click="emit('copyArtifactCode')">复制源码</button>
        <small v-if="props.artifactCodeCopyMessage" data-testid="vue-artifact-copy-code-status" role="status">{{ props.artifactCodeCopyMessage }}</small>
      </header>
      <div class="workspace-artifacts__code-preview" data-testid="vue-artifact-code-preview">
        <ArtifactCodeViewer
          v-if="props.selectedArtifactPreviewContent !== null"
          :code="props.selectedArtifactPreviewContent"
          :filename="props.selectedArtifactViewer.filename"
          :language="props.selectedArtifactCodeLanguage"
        />
        <span v-else-if="props.artifactContentLoading" data-testid="vue-artifact-code-loading" role="status">正在加载 {{ props.selectedArtifactViewer.filename }}...</span>
        <span v-else-if="props.artifactContentError" data-testid="vue-artifact-code-error" role="alert">{{ props.artifactContentError }}</span>
        <span v-else>{{ props.selectedArtifactViewer.artifactUrl }}</span>
      </div>
    </div>
  </div>
  <div v-else class="workspace-artifacts__fallback" data-testid="vue-artifact-download-fallback">
    <strong>{{ props.selectedArtifactViewer.filename }}</strong>
    <span>{{ props.selectedArtifactViewer.extensionLabel }} file</span>
    <p>{{ props.selectedArtifactViewer.fallbackDescription }}</p>
  </div>
</template>
