<script setup lang="ts">
/*
  【文件职责】     编排 artifact 分类、有限加载、预览、编辑、动作与 stale 结果隔离。
  【对应 frontend/】 src/components/workspace/artifacts/artifact-panel.tsx
  【架构位置】     L3 extension reference
  【主要导出】     默认 ArtifactPanel 组件
  【依赖关系】     ArtifactPolicy · useArtifactDraft · ArtifactFileList/Editor/Preview/Actions
  【边界与注意】   drafts/离开决策由父层唯一 owner 持有；本组件只拥有当前 path 的短生命周期 I/O。
*/
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Eye, X } from "lucide-vue-next";

import ArtifactActions from "./ArtifactActions.vue";
import ArtifactEditor from "./ArtifactEditor.vue";
import ArtifactFileList from "./ArtifactFileList.vue";
import ArtifactPreview from "./ArtifactPreview.vue";

import {
  ArtifactRequestError,
  updateArtifactContent,
} from "@/core/artifacts/api";
import { probeArtifactAction } from "@/core/artifacts/actions";
import {
  loadArtifactContent,
  loadArtifactContentFromToolCall,
} from "@/core/artifacts/loader";
import {
  canInstallSkillArtifact,
  canLoadArtifactText,
  canSaveArtifactText,
  classifyArtifact,
} from "@/core/artifacts/policy";
import { canRenderArtifactHtml } from "@/core/artifacts/preview-policy";
import { urlOfArtifact } from "@/core/artifacts/utils";
import { writeTextToClipboard } from "@/core/clipboard";
import { installSkill } from "@/core/skills/api";
import type { Message } from "@/core/types/message";
import type { ArtifactDraftOwner } from "@/composables/useArtifactDraft";

const props = defineProps<{
  threadId: string;
  selected: string;
  artifacts: string[];
  openedPresentedArtifacts: string[];
  messages: Message[];
  streaming: boolean;
  isMock?: boolean;
  isAdmin?: boolean;
  draftOwner: ArtifactDraftOwner;
}>();
const { $i18n } = useNuxtApp();
const emit = defineEmits<{ close: []; select: [path: string] }>();

const content = ref("");
const contentUrl = ref<string>();
const sha256 = ref<string>();
const truncated = ref(false);
const fullContentLoaded = ref(false);
const previewBytes = ref<number>();
const totalBytes = ref<number>();
const loading = ref(false);
const error = ref("");
const notice = ref("");
const viewMode = ref<"code" | "preview">("code");
const saving = ref(false);
const installing = ref(false);
let loadGeneration = 0;
let saveGeneration = 0;
let actionGeneration = 0;
let loadController: AbortController | null = null;
let actionController: AbortController | null = null;
let disposed = false;

const isWrite = computed(() => props.selected.startsWith("write-file:"));
const filepath = computed(() => {
  if (!isWrite.value) return props.selected;
  try {
    return decodeURIComponent(new URL(props.selected).pathname);
  } catch {
    return props.selected.slice("write-file:".length);
  }
});
const filename = computed(
  () => filepath.value.split("/").filter(Boolean).at(-1) ?? filepath.value,
);
const policy = computed(() =>
  classifyArtifact(props.selected, { isMock: props.isMock }),
);
const toolResult = computed(() => {
  if (!isWrite.value) return undefined;
  let callId: string | null = null;
  try {
    callId = new URL(props.selected).searchParams.get("tool_call_id");
  } catch {
    return undefined;
  }
  if (!callId) return undefined;
  const message = props.messages.find(
    (candidate) =>
      candidate.type === "tool" && candidate.tool_call_id === callId,
  );
  return typeof message?.content === "string" ? message.content : undefined;
});
const options = computed(() => [
  ...new Set([
    ...props.openedPresentedArtifacts.filter(
      (path) => !props.artifacts.includes(path),
    ),
    ...props.artifacts,
  ]),
]);
const activeDraft = computed(() => props.draftOwner.ensure(filepath.value));
const editing = computed(
  () => props.draftOwner.editingPath.value === filepath.value,
);
const dirty = computed(
  () => activeDraft.value.draftContent !== activeDraft.value.baselineContent,
);
const canEdit = computed(() =>
  canSaveArtifactText(policy.value, {
    hasRevision: Boolean(sha256.value),
    fullContentLoaded: fullContentLoaded.value,
  }),
);
const sourceUrl = computed(() =>
  urlOfArtifact({
    filepath: filepath.value,
    threadId: props.threadId,
    isMock: props.isMock,
  }),
);
const downloadUrl = computed(() =>
  urlOfArtifact({
    filepath: filepath.value,
    threadId: props.threadId,
    download: true,
    isMock: props.isMock,
  }),
);
const htmlPreviewAllowed = computed(
  () =>
    policy.value.kind === "text" &&
    policy.value.language === "html" &&
    canRenderArtifactHtml({
      source:
        policy.value.source === "write-file-draft"
          ? policy.value.source
          : "formal",
      content: content.value,
      truncated: truncated.value,
      fullContentLoaded: fullContentLoaded.value,
      toolResult: toolResult.value,
    }),
);
const previewAllowed = computed(() => {
  if (
    policy.value.kind === "browser-media" ||
    policy.value.kind === "safe-document"
  ) {
    return true;
  }
  if (policy.value.kind !== "text") return false;
  if (
    policy.value.source === "write-file-draft" &&
    toolResult.value !== undefined &&
    toolResult.value.trim() !== "OK"
  ) {
    return false;
  }
  return policy.value.language === "markdown" || htmlPreviewAllowed.value;
});
const canCopy = computed(
  () => policy.value.kind === "text" && !truncated.value && !loading.value,
);
const hasGatewayArtifact = computed(
  () => policy.value.source !== "write-file-draft",
);
const canInstall = computed(() =>
  canInstallSkillArtifact(policy.value, { isAdmin: props.isAdmin === true }),
);

function resetTransientState() {
  loading.value = false;
  content.value = "";
  contentUrl.value = undefined;
  sha256.value = undefined;
  truncated.value = false;
  fullContentLoaded.value = false;
  previewBytes.value = undefined;
  totalBytes.value = undefined;
  error.value = "";
  notice.value = "";
  viewMode.value = "code";
}

async function load(full = false) {
  const generation = ++loadGeneration;
  const selected = props.selected;
  const threadId = props.threadId;
  error.value = "";
  notice.value = "";

  if (policy.value.source === "write-file-draft") {
    const draft = loadArtifactContentFromToolCall({
      url: selected,
      thread: { messages: props.messages } as never,
    });
    content.value = typeof draft === "string" ? draft : "";
    truncated.value = false;
    fullContentLoaded.value = toolResult.value !== undefined;
    viewMode.value = previewAllowed.value ? "preview" : "code";
    return;
  }

  if (!canLoadArtifactText(policy.value)) {
    loading.value = false;
    return;
  }

  loadController?.abort();
  loadController = new AbortController();
  loading.value = true;
  try {
    const result = await loadArtifactContent({
      filepath: selected,
      threadId,
      isMock: props.isMock,
      full,
      signal: loadController.signal,
    });
    if (
      disposed ||
      generation !== loadGeneration ||
      selected !== props.selected ||
      threadId !== props.threadId
    ) {
      return;
    }
    content.value = result.content;
    contentUrl.value = result.url;
    sha256.value = result.sha256;
    truncated.value = result.truncated;
    fullContentLoaded.value = !result.truncated;
    previewBytes.value = result.previewBytes;
    totalBytes.value = result.totalBytes;
    if (result.sha256) {
      props.draftOwner.reconcile(filepath.value, {
        content: result.content,
        sha256: result.sha256,
      });
    }
    viewMode.value = previewAllowed.value ? "preview" : "code";
  } catch (reason) {
    if (
      generation === loadGeneration &&
      !disposed &&
      !(reason instanceof DOMException && reason.name === "AbortError")
    ) {
      error.value =
        reason instanceof Error
          ? reason.message
          : $i18n.t.value.artifacts.loadFailed;
    }
  } finally {
    if (generation === loadGeneration && !disposed) {
      loading.value = false;
      loadController = null;
    }
  }
}

watch(
  () => [props.selected, props.threadId] as const,
  () => {
    loadGeneration += 1;
    saveGeneration += 1;
    actionGeneration += 1;
    loadController?.abort();
    loadController = null;
    actionController?.abort();
    actionController = null;
    saving.value = false;
    installing.value = false;
    resetTransientState();
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

function beginEdit() {
  if (canEdit.value) props.draftOwner.beginEdit(filepath.value);
}

function updateDraft(value: string) {
  props.draftOwner.update(filepath.value, value);
}

function discard() {
  props.draftOwner.discard(filepath.value);
  props.draftOwner.requestExitEdit(filepath.value);
  content.value = activeDraft.value.remoteContent;
  sha256.value = activeDraft.value.remoteSha256 ?? undefined;
  error.value = "";
}

function exitEdit() {
  if (!props.draftOwner.requestExitEdit(filepath.value)) return;
  content.value = activeDraft.value.remoteContent;
  sha256.value = activeDraft.value.remoteSha256 ?? undefined;
  error.value = "";
}

async function save() {
  const draft = activeDraft.value;
  if (
    !canEdit.value ||
    !dirty.value ||
    props.streaming ||
    saving.value ||
    draft.conflict ||
    !draft.baselineSha256
  ) {
    return;
  }
  const generation = ++saveGeneration;
  const selected = props.selected;
  const threadId = props.threadId;
  const path = filepath.value;
  const savedContent = draft.draftContent;
  saving.value = true;
  error.value = "";
  try {
    const result = await updateArtifactContent({
      threadId,
      filepath: path,
      content: savedContent,
      expectedSha256: draft.baselineSha256,
    });
    if (
      disposed ||
      generation !== saveGeneration ||
      selected !== props.selected ||
      threadId !== props.threadId
    ) {
      return;
    }
    props.draftOwner.completeSave(path, result.sha256);
    content.value = savedContent;
    sha256.value = result.sha256;
    props.draftOwner.requestExitEdit(path);
  } catch (reason) {
    if (
      disposed ||
      generation !== saveGeneration ||
      selected !== props.selected ||
      threadId !== props.threadId
    ) {
      return;
    }
    const status =
      reason instanceof ArtifactRequestError ? reason.status : undefined;
    if (status !== undefined) props.draftOwner.failSave(path, status);
    error.value =
      reason instanceof Error
        ? reason.message
        : $i18n.t.value.artifacts.saveFailed;
  } finally {
    if (generation === saveGeneration && !disposed) saving.value = false;
  }
}

async function copyArtifact() {
  error.value = "";
  if ((await writeTextToClipboard(content.value)) === false) {
    error.value = $i18n.t.value.artifacts.copyFailed;
  }
}

async function runGatewayAction(kind: "open" | "download") {
  const generation = ++actionGeneration;
  actionController?.abort();
  actionController = new AbortController();
  error.value = "";
  const url = kind === "open" ? sourceUrl.value : downloadUrl.value;
  try {
    await probeArtifactAction(url, actionController.signal);
    if (disposed || generation !== actionGeneration) return;
    if (kind === "open") {
      globalThis.open(url, "_blank", "noopener,noreferrer");
    } else {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename.value;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  } catch (reason) {
    if (generation === actionGeneration && !disposed) {
      error.value =
        reason instanceof Error
          ? reason.message
          : kind === "open"
            ? $i18n.t.value.artifacts.openFailed
            : $i18n.t.value.artifacts.downloadFailed;
    }
  } finally {
    if (generation === actionGeneration) actionController = null;
  }
}

async function installArtifactSkill() {
  if (!canInstall.value || installing.value) return;
  const generation = ++actionGeneration;
  installing.value = true;
  error.value = "";
  notice.value = "";
  try {
    const result = await installSkill({
      thread_id: props.threadId,
      path: filepath.value,
    });
    if (disposed || generation !== actionGeneration) return;
    if (!result.success) {
      error.value = result.message;
      return;
    }
    notice.value = result.message;
  } catch (reason) {
    if (generation === actionGeneration && !disposed) {
      error.value =
        reason instanceof Error
          ? reason.message
          : $i18n.t.value.artifacts.installFailed;
    }
  } finally {
    if (generation === actionGeneration && !disposed) installing.value = false;
  }
}

async function loadFull() {
  await load(true);
}

onBeforeUnmount(() => {
  disposed = true;
  loadGeneration += 1;
  saveGeneration += 1;
  actionGeneration += 1;
  loadController?.abort();
  loadController = null;
  actionController?.abort();
  actionController = null;
});
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
      <ArtifactFileList
        v-if="!isWrite"
        :current="filepath"
        :options="options"
        @select="emit('select', $event)"
      />
      <strong v-else class="min-w-0 flex-1 truncate text-sm">{{
        filename
      }}</strong>
      <button
        v-if="
          policy.kind === 'text' &&
          ['html', 'markdown'].includes(policy.language) &&
          previewAllowed
        "
        type="button"
        :aria-label="
          viewMode === 'preview'
            ? $i18n.t.value.artifacts.actions.showCode
            : $i18n.t.value.artifacts.actions.showPreview
        "
        class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
        @click="viewMode = viewMode === 'preview' ? 'code' : 'preview'"
      >
        <Eye :size="15" />
      </button>
      <ArtifactActions
        :can-edit="canEdit"
        :editing="editing"
        :dirty="dirty"
        :conflict="activeDraft.conflict"
        :streaming="streaming"
        :saving="saving"
        :can-copy="canCopy"
        :can-open="hasGatewayArtifact"
        :can-download="hasGatewayArtifact"
        :can-install="canInstall"
        :installing="installing"
        @edit="beginEdit"
        @save="save"
        @exit="exitEdit"
        @discard="discard"
        @copy="copyArtifact"
        @open="runGatewayAction('open')"
        @download="runGatewayAction('download')"
        @install="installArtifactSkill"
      />
      <button
        type="button"
        :aria-label="$i18n.t.value.artifacts.actions.close"
        class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
        @click="emit('close')"
      >
        <X :size="16" />
      </button>
    </header>

    <p v-if="error" role="alert" class="text-destructive px-4 pt-3 text-sm">
      {{ error }}
    </p>
    <p v-if="notice" role="status" class="px-4 pt-3 text-sm">{{ notice }}</p>
    <div class="relative min-h-0 flex-1 overflow-auto">
      <p v-if="loading" class="text-muted-foreground p-4 text-sm">
        {{ $i18n.t.value.artifacts.loading }}
      </p>
      <ArtifactEditor
        v-else-if="editing && canEdit"
        :model-value="activeDraft.draftContent"
        @update:model-value="updateDraft"
      />
      <ArtifactPreview
        v-else
        :policy="policy"
        :filename="filename"
        :content="content"
        :url="sourceUrl"
        :content-url="contentUrl"
        :view-mode="viewMode"
        :html-preview-allowed="htmlPreviewAllowed"
      />
      <div
        v-if="truncated"
        class="border-border bg-background sticky right-0 bottom-0 left-0 flex items-center justify-between border-t px-4 py-3 text-sm"
      >
        <span class="text-muted-foreground">
          {{
            $i18n.t.value.artifacts.previewedBytes(
              String(previewBytes),
              totalBytes === null
                ? $i18n.t.value.artifacts.unknownTotalBytes
                : String(totalBytes),
            )
          }}
        </span>
        <button
          type="button"
          :aria-label="$i18n.t.value.artifacts.actions.loadFull"
          class="rounded border px-3 py-1.5"
          :disabled="loading"
          @click="loadFull"
        >
          {{ $i18n.t.value.artifacts.actions.loadFull }}
        </button>
      </div>
    </div>
  </section>
</template>
