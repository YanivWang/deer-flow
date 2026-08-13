<script setup lang="ts">
/*
  【文件职责】     DeerFlow artifact 加载、预览、编辑、冲突和下载面板。
  【对应 frontend/】 src/components/workspace/artifacts/artifact-panel.tsx
  【架构位置】     L3 extension reference
  【主要导出】     默认 ArtifactPanel 组件
  【依赖关系】     artifacts API · StreamMarkdown L2 · useArtifactsPanel
  【边界与注意】   M8 的单向扩展参考：消费 L2，artifact 业务不得反向进入 L2。
*/
import { computed, reactive, ref, watch } from "vue";
import { Download, Edit3, Eye, Save, X } from "lucide-vue-next";

import StreamMarkdown from "@/components/markdown/StreamMarkdown.vue";
import {
  updateArtifactContent,
  ArtifactRequestError,
} from "@/core/artifacts/api";
import {
  canEditOpenedArtifact,
  createArtifactDraft,
  reconcileArtifactDraft,
  type ArtifactDraftState,
} from "@/core/artifacts/editing";
import {
  loadArtifactContent,
  loadArtifactContentFromToolCall,
} from "@/core/artifacts/loader";
import {
  getArtifactViewState,
  isWriteFileArtifact,
  rewriteHtmlPreviewResourceUrls,
} from "@/core/artifacts/preview";
import { urlOfArtifact } from "@/core/artifacts/utils";
import type { Message } from "@/core/types/message";
import {
  rawHtmlRehypePlugins,
  rehypeHeadingSlugs,
} from "@/core/markdown/plugins";
import type { PluggableList } from "unified";

const props = defineProps<{
  threadId: string;
  selected: string;
  artifacts: string[];
  openedPresentedArtifacts: string[];
  messages: Message[];
  streaming: boolean;
  isMock?: boolean;
}>();
const emit = defineEmits<{
  close: [];
  select: [path: string];
}>();

const content = ref("");
const contentUrl = ref<string>();
const sha256 = ref<string>();
const truncated = ref(false);
const previewBytes = ref<number>();
const totalBytes = ref<number>();
const loading = ref(false);
const error = ref("");
const artifactMenuOpen = ref(false);
const fullRequested = ref(false);
const viewMode = ref<"code" | "preview">("code");
const editing = ref(false);
const saving = ref(false);
const drafts = reactive<Record<string, ArtifactDraftState>>({});
const artifactRehypePlugins: PluggableList = [
  ...rawHtmlRehypePlugins.slice(0, 1),
  rehypeHeadingSlugs,
  ...rawHtmlRehypePlugins.slice(1),
];

const isWrite = computed(() => isWriteFileArtifact(props.selected));
const filepath = computed(() => {
  if (!isWrite.value) return props.selected;
  try {
    return decodeURIComponent(new URL(props.selected).pathname);
  } catch {
    return props.selected.replace(/^write-file:/, "");
  }
});
const filename = computed(
  () => filepath.value.split("/").filter(Boolean).at(-1) ?? filepath.value,
);
const extension = computed(
  () => filename.value.split(".").at(-1)?.toLowerCase() ?? "",
);
const browserKind = computed<"image" | "audio" | "video" | "document" | null>(
  () => {
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension.value))
      return "image";
    if (["mp3", "wav", "ogg", "m4a"].includes(extension.value)) return "audio";
    if (["mp4", "webm", "mov"].includes(extension.value)) return "video";
    if (["pdf"].includes(extension.value)) return "document";
    return null;
  },
);
const language = computed(() => {
  if (["md", "markdown", "skill"].includes(extension.value)) return "markdown";
  if (["html", "htm"].includes(extension.value)) return "html";
  return "text";
});
const codeFile = computed(
  () => browserKind.value === null || language.value !== "text",
);
const toolResult = computed(() => {
  if (!isWrite.value) return undefined;
  const callId = new URL(props.selected).searchParams.get("tool_call_id");
  if (!callId) return undefined;
  const result = props.messages.find(
    (message) => message.type === "tool" && message.tool_call_id === callId,
  );
  if (!result) return undefined;
  return typeof result.content === "string" ? result.content : undefined;
});
const previewState = computed(() =>
  getArtifactViewState({
    filepath: props.selected,
    isSupportPreview:
      language.value === "html" || language.value === "markdown",
    toolResult: toolResult.value,
    content: content.value,
  }),
);
const src = computed(() =>
  urlOfArtifact({
    filepath: filepath.value,
    threadId: props.threadId,
    isMock: props.isMock,
  }),
);
const options = computed(() => {
  const opened = props.openedPresentedArtifacts.filter(
    (path) => !props.artifacts.includes(path),
  );
  return [...new Set([...opened, ...props.artifacts])];
});
const activeDraft = computed(
  () => drafts[filepath.value] ?? createArtifactDraft(filepath.value),
);
const dirty = computed(
  () => activeDraft.value.draftContent !== activeDraft.value.baselineContent,
);
const canEdit = computed(() =>
  canEditOpenedArtifact({
    filepath: filepath.value,
    isCodeFile: codeFile.value,
    isWriteFile: isWrite.value,
    isSkillFile: filepath.value.endsWith(".skill"),
    isMock: props.isMock ?? false,
    hasRevision: Boolean(sha256.value),
    isStaticWebsite: false,
  }),
);
const displayedContent = computed(() =>
  editing.value ? activeDraft.value.draftContent : content.value,
);

async function load(full = false) {
  loading.value = true;
  error.value = "";
  try {
    if (isWrite.value) {
      const draft = loadArtifactContentFromToolCall({
        url: props.selected,
        thread: { messages: props.messages } as never,
      });
      content.value = typeof draft === "string" ? draft : "";
      contentUrl.value = undefined;
      sha256.value = undefined;
      truncated.value = false;
    } else if (browserKind.value === null || language.value !== "text") {
      const result = await loadArtifactContent({
        filepath: props.selected,
        threadId: props.threadId,
        isMock: props.isMock,
        full,
      });
      content.value = result.content;
      contentUrl.value = result.url;
      sha256.value = result.sha256;
      truncated.value = result.truncated;
      previewBytes.value = result.previewBytes;
      totalBytes.value = result.totalBytes;
      if (result.sha256) {
        const current =
          drafts[filepath.value] ?? createArtifactDraft(filepath.value);
        drafts[filepath.value] = reconcileArtifactDraft(current, {
          content: result.content,
          sha256: result.sha256,
        });
      }
    }
    viewMode.value = previewState.value.initialViewMode;
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : "Failed to load artifact";
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.selected, props.threadId] as const,
  () => {
    fullRequested.value = false;
    editing.value = false;
    void load(false);
  },
  { immediate: true },
);
watch(
  () => props.messages,
  () => {
    if (isWrite.value) void load(false);
  },
  { deep: true },
);

async function loadFull() {
  fullRequested.value = true;
  await load(true);
}
function beginEdit() {
  if (!canEdit.value) return;
  editing.value = true;
}
function selectArtifact(path: string) {
  artifactMenuOpen.value = false;
  emit("select", path);
}
async function save() {
  if (
    !canEdit.value ||
    !dirty.value ||
    props.streaming ||
    saving.value ||
    activeDraft.value.conflict ||
    !activeDraft.value.baselineSha256
  )
    return;
  saving.value = true;
  try {
    const result = await updateArtifactContent({
      threadId: props.threadId,
      filepath: filepath.value,
      content: activeDraft.value.draftContent,
      expectedSha256: activeDraft.value.baselineSha256,
    });
    drafts[filepath.value] = {
      filepath: filepath.value,
      baselineContent: activeDraft.value.draftContent,
      baselineSha256: result.sha256,
      draftContent: activeDraft.value.draftContent,
      conflict: false,
    };
    content.value = activeDraft.value.draftContent;
    sha256.value = result.sha256;
    editing.value = false;
  } catch (reason) {
    if (reason instanceof ArtifactRequestError && reason.status === 412) {
      drafts[filepath.value] = { ...activeDraft.value, conflict: true };
      error.value = "The artifact changed remotely. Your draft was preserved.";
    } else if (
      reason instanceof ArtifactRequestError &&
      reason.status === 409
    ) {
      error.value = "The artifact cannot be saved while a run is active.";
    } else {
      error.value = reason instanceof Error ? reason.message : "Save failed";
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section
    id="artifacts"
    class="flex size-full min-h-0 flex-col"
    aria-hidden="false"
  >
    <header
      class="border-border flex h-12 shrink-0 items-center gap-2 border-b px-3"
    >
      <div v-if="!isWrite" class="relative min-w-0 flex-1">
        <button
          type="button"
          role="combobox"
          :aria-expanded="artifactMenuOpen"
          aria-label="Select artifact"
          class="hover:bg-accent block h-8 w-full truncate rounded px-2 text-left text-sm font-medium"
          @click="artifactMenuOpen = !artifactMenuOpen"
        >
          {{ filename }}
        </button>
        <div
          v-if="artifactMenuOpen"
          role="listbox"
          class="bg-background border-border absolute top-full left-0 z-40 mt-1 max-h-64 min-w-full overflow-auto rounded-md border p-1 shadow-lg"
        >
          <button
            v-for="option in options"
            :key="option"
            type="button"
            role="option"
            :aria-selected="option === filepath"
            class="hover:bg-accent block w-full rounded px-2 py-1.5 text-left text-sm whitespace-nowrap"
            @click="selectArtifact(option)"
          >
            {{ option.split("/").at(-1) }}
          </button>
        </div>
      </div>
      <strong v-else class="min-w-0 flex-1 truncate text-sm">{{
        filename
      }}</strong>
      <button
        v-if="previewState.canPreview"
        type="button"
        :aria-label="viewMode === 'preview' ? 'Show code' : 'Show preview'"
        class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
        @click="viewMode = viewMode === 'preview' ? 'code' : 'preview'"
      >
        <Eye :size="15" />
      </button>
      <button
        v-if="canEdit && !editing"
        type="button"
        aria-label="Edit artifact"
        class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
        @click="beginEdit"
      >
        <Edit3 :size="15" />
      </button>
      <button
        v-if="editing"
        type="button"
        aria-label="Save artifact"
        class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
        :disabled="streaming || saving || !dirty || activeDraft.conflict"
        @click="save"
      >
        <Save :size="15" />
      </button>
      <a
        :href="urlOfArtifact({ filepath, threadId, download: true, isMock })"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download artifact"
        class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
      >
        <Download :size="15" />
      </a>
      <button
        type="button"
        aria-label="Close artifacts"
        class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
        @click="emit('close')"
      >
        <X :size="16" />
      </button>
    </header>

    <div class="relative min-h-0 flex-1 overflow-auto">
      <p v-if="loading" class="text-muted-foreground p-4 text-sm">
        Loading artifact…
      </p>
      <p v-else-if="error" class="text-destructive p-4 text-sm">{{ error }}</p>
      <template v-else-if="browserKind && language === 'text'">
        <img
          v-if="browserKind === 'image'"
          :src="src"
          :alt="filename"
          class="size-full object-contain"
        />
        <audio
          v-else-if="browserKind === 'audio'"
          :src="src"
          :aria-label="filename"
          controls
          class="m-auto w-4/5"
        />
        <video
          v-else-if="browserKind === 'video'"
          :src="src"
          :aria-label="filename"
          controls
          playsinline
          class="size-full bg-black object-contain"
        />
        <iframe v-else :src="src" class="size-full" sandbox="" />
      </template>
      <textarea
        v-else-if="editing"
        v-model="drafts[filepath]!.draftContent"
        class="size-full resize-none bg-transparent p-4 font-mono text-xs outline-none"
        spellcheck="false"
      />
      <div
        v-else-if="viewMode === 'preview' && language === 'markdown'"
        class="size-full overflow-auto px-4 py-3"
      >
        <StreamMarkdown
          :content="displayedContent"
          :rehype-plugins="artifactRehypePlugins"
        />
      </div>
      <iframe
        v-else-if="viewMode === 'preview' && language === 'html'"
        title="Artifact preview"
        class="size-full"
        sandbox="allow-scripts allow-forms"
        :srcdoc="rewriteHtmlPreviewResourceUrls(displayedContent, contentUrl)"
      />
      <pre
        v-else
        class="min-h-full overflow-auto p-4 font-mono text-xs leading-5 whitespace-pre-wrap"
        >{{ displayedContent }}</pre>
      <div
        v-if="truncated && !fullRequested"
        class="border-border bg-background sticky right-0 bottom-0 left-0 flex items-center justify-between border-t px-4 py-3 text-sm"
      >
        <span class="text-muted-foreground">
          Previewed {{ previewBytes }} of {{ totalBytes ?? "many" }} bytes
        </span>
        <button
          type="button"
          class="rounded border px-3 py-1.5"
          @click="loadFull"
        >
          Load full file
        </button>
      </div>
    </div>
  </section>
</template>
