<script setup lang="ts">
import {
  pathAfterDeletingThread,
  shouldResetChatStateForThreadChange,
} from "../../../core/api/thread/utils";
import { installSkill } from "../../../core/api/skills/client";
import {
  buildHumanInputResponseText,
  type HumanInputRequest,
  type HumanInputResponse,
} from "../../../core/messages/human-input";
import {
  artifactCodeInfo,
  artifactCodeLanguage,
  artifactFilename,
  describeArtifactViewer,
} from "../../../core/artifacts/utils";
import {
  appendHtmlPreviewScrollRestoration,
  collectHtmlPreviewResourceUrls,
  createHtmlPreviewScrollKey,
  HTML_PREVIEW_SCROLL_MESSAGE_SOURCE,
  resolveHtmlPreviewResourceReference,
  rewriteHtmlPreviewResourceUrls,
} from "../../../core/artifacts/preview";
import type { ThreadMode } from "../../../core/settings/local";
import { createId } from "../../../core/utils/id";

const route = useRoute();
const router = useRouter();
const draft = ref("");
const goalDraft = ref("");
const renameDraft = ref("");
const renameErrorMessage = ref<string | null>(null);
const threadId = computed(() => String(route.params.thread_id ?? ""));
const {
  errorMessage,
  isBusy,
  isStreaming,
  reset,
  sendMessage,
  setHistoryMessages,
  status,
  stop,
  viewModel,
} = useThreadStream();
const history = useThreadHistory(threadId);
const threadList = useThreadList();
const threads = threadList.threads;
const currentThread = computed(() =>
  threads.value.find((thread) => thread.thread_id === threadId.value),
);
const artifactPathname = computed(() => route.path);
const discoveredArtifacts = computed(() => currentThread.value?.values.artifacts ?? []);
const {
  artifacts,
  open: artifactPanelOpen,
  selectArtifact,
  selectedArtifact,
  setOpen: setArtifactPanelOpen,
} = useArtifactPanel(artifactPathname, discoveredArtifacts);
const selectedArtifactViewer = computed(() =>
  selectedArtifact.value
    ? describeArtifactViewer({
        filepath: selectedArtifact.value,
        threadId: threadId.value,
      })
    : null,
);
const selectedArtifactCodeInfo = computed(() =>
  selectedArtifact.value ? artifactCodeInfo(selectedArtifact.value) : null,
);
const selectedArtifactCanShowCode = computed(() =>
  selectedArtifactCodeInfo.value?.isCodeFile === true,
);
const selectedArtifactCanShowBrowserPreview = computed(() =>
  Boolean(
    selectedArtifactViewer.value?.previewKind
      && selectedArtifactViewer.value.previewKind !== "code",
  ),
);
const selectedArtifactCanToggleView = computed(() =>
  selectedArtifactCanShowCode.value && selectedArtifactCanShowBrowserPreview.value,
);
const artifactViewMode = ref<"preview" | "code">("preview");
const selectedArtifactNeedsPreviewContent = computed(() => {
  const previewKind = selectedArtifactViewer.value?.previewKind;
  return artifactViewMode.value === "preview"
    && (previewKind === "html" || previewKind === "markdown");
});
const shouldLoadArtifactContent = computed(
  () =>
    selectedArtifactCanShowCode.value
    && (artifactViewMode.value === "code" || selectedArtifactNeedsPreviewContent.value),
);
const artifactContent = useArtifactContent({
  enabled: shouldLoadArtifactContent,
  filepath: selectedArtifact,
  threadId,
});
const artifactHtmlPreviewUrl = ref<string | null>(null);
const artifactHtmlPreviewErrorMessage = ref<string | null>(null);
const artifactHtmlPreviewIframe = ref<HTMLIFrameElement | null>(null);
const artifactHtmlPreviewScrollPosition = ref({ x: 0, y: 0 });
const artifactHtmlPreviewScrollKey = computed(() =>
  selectedArtifact.value ? createHtmlPreviewScrollKey(selectedArtifact.value) : "",
);
const selectedArtifactCodeLanguage = computed(() =>
  selectedArtifact.value ? artifactCodeLanguage(selectedArtifact.value) : "text",
);
const selectedArtifactCodeLineCount = computed(() =>
  artifactContent.content.value ? artifactContent.content.value.split(/\r?\n/).length : 0,
);
const artifactCopyMessage = ref<string | null>(null);
const artifactCodeCopyMessage = ref<string | null>(null);
const artifactSkillInstallMessage = ref<string | null>(null);
const artifactSkillInstallError = ref<string | null>(null);
const isInstallingArtifactSkill = ref(false);
const canInstallSelectedArtifactSkill = computed(() =>
  selectedArtifact.value ? isSkillArchiveArtifact(selectedArtifact.value) : false,
);
const serverGoal = computed(() => currentThread.value?.values.goal);
const {
  activeGoal,
  clearGoal,
  goalErrorMessage,
  hasGoal,
  isGoalPending,
  refreshGoal,
  saveGoal,
} = useThreadGoal(threadId, serverGoal);
const goalContinuation = computed(() =>
  activeGoal.value ? getGoalContinuationDisplay(activeGoal.value) : null,
);
const isThreadListLoading = computed(() => threadList.query.isLoading.value);
const historyHasMore = computed(() => history.hasMore.value);
const historyIsLoading = computed(() => history.isLoading.value);
const threadListHasMore = computed(() => threadList.hasMoreThreads.value);
const threadListIsLoadingMore = computed(() => threadList.isLoadingMoreThreads.value);
const agentName = computed(() => routeParamString(route.params.agent_name));
const serverThreadContext = computed(() => currentThread.value?.context ?? null);
const {
  effectiveContext,
  resetContext: resetLocalThreadContext,
  updateContext: updateLocalThreadContext,
} = useLocalThreadSettings(threadId, serverThreadContext);
const threadRunContext = computed(() =>
  buildRunContext(effectiveContext.value, agentName.value),
);
const compactAgentName = computed(
  () => readOptionalString(threadRunContext.value?.agent_name) ?? null,
);
const compactModelName = computed(() => readOptionalString(threadRunContext.value?.model_name) ?? null);
const canCompactThread = computed(() => Boolean(currentThread.value) && viewModel.value.messageCount > 0);
const {
  compactErrorMessage,
  compactNoticeMessage,
  compactThread,
  isCompacting,
} = useThreadCompaction({
  agentName: compactAgentName,
  canCompact: canCompactThread,
  isBusy,
  modelName: compactModelName,
  threadId,
});
const threadActionErrorMessage = computed(
  () =>
    threadList.createThreadErrorMessage.value ??
    threadList.pinThreadErrorMessage.value ??
    threadList.deleteThreadErrorMessage.value,
);
const activeThreadPinned = computed(() =>
  currentThread.value ? threadList.isThreadPinned(currentThread.value) : false,
);

watch(
  () => history.messages.value,
  (messages) => {
    setHistoryMessages(messages);
  },
  { immediate: true },
);

watch(threadId, (nextThreadId, previousThreadId) => {
  if (!shouldResetChatStateForThreadChange(previousThreadId, nextThreadId)) {
    return;
  }
  draft.value = "";
  renameDraft.value = "";
  renameErrorMessage.value = null;
  reset();
});

watch(
  () => selectedArtifact.value,
  () => {
    artifactViewMode.value = selectedArtifactCanShowBrowserPreview.value ? "preview" : "code";
    artifactCodeCopyMessage.value = null;
  },
  { immediate: true },
);

watch(artifactHtmlPreviewScrollKey, () => {
  artifactHtmlPreviewScrollPosition.value = { x: 0, y: 0 };
});

watch(
  [
    () => artifactContent.content.value,
    () => artifactContent.errorMessage.value,
    () => artifactContent.isLoading.value,
    () => artifactContent.url.value,
    () => artifactViewMode.value,
    () => selectedArtifactViewer.value?.previewKind,
  ],
  (_value, _oldValue, onCleanup) => {
    const abortController = new AbortController();
    let isCancelled = false;
    onCleanup(() => {
      isCancelled = true;
      abortController.abort();
    });

    const shouldBuildHtmlPreview =
      artifactViewMode.value === "preview"
      && selectedArtifactViewer.value?.previewKind === "html";
    if (!shouldBuildHtmlPreview) {
      revokeArtifactHtmlPreviewUrl();
      artifactHtmlPreviewErrorMessage.value = null;
      return;
    }

    const sourceContent = artifactContent.content.value;
    const sourceUrl = artifactContent.url.value ?? selectedArtifactViewer.value?.artifactUrl;
    if (sourceContent === null) {
      revokeArtifactHtmlPreviewUrl();
      artifactHtmlPreviewErrorMessage.value = artifactContent.errorMessage.value;
      return;
    }

    void buildArtifactHtmlPreview({
      abortController,
      isCancelled: () => isCancelled,
      scrollKey: selectedArtifact.value ?? "artifact",
      sourceContent,
      sourceUrl,
    });
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener("message", handleArtifactHtmlPreviewMessage);
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handleArtifactHtmlPreviewMessage);
  revokeArtifactHtmlPreviewUrl();
});

const activeThreadTitle = computed(() => {
  return currentThread.value ? threadList.titleOfThread(currentThread.value) : threadId.value;
});

async function submitMessage() {
  if (isBusy.value) {
    return;
  }

  const text = draft.value.trim();
  if (!text) {
    draft.value = "";
    return;
  }

  draft.value = "";
  try {
    const context = threadRunContext.value;
    await sendMessage({
      ...(context ? { context } : {}),
      text,
      threadId: threadId.value,
    });
    await threadList.query.refetch();
  } catch {
    draft.value = text;
  }
}

async function submitHumanInput(request: HumanInputRequest, response: HumanInputResponse) {
  if (isBusy.value) {
    return false;
  }
  const context = threadRunContext.value;
  await sendMessage({
    ...(context ? { context } : {}),
    additionalKwargs: {
      hide_from_ui: true,
      human_input_response: response,
    },
    text: buildHumanInputResponseText(request, response),
    threadId: threadId.value,
  });
  await threadList.query.refetch();
  return true;
}

async function stopStream() {
  await stop();
  await history.query.refetch();
  await threadList.query.refetch();
}

async function createNewThread() {
  try {
    const thread = await threadList.createThread({
      agentName: compactAgentName.value,
      threadId: createId(),
    });
    await router.push(threadList.pathOfThread(thread.thread_id, threadRunContext.value));
  } catch {
    // The mutation error is rendered through the sidebar action alert.
  }
}

async function renameActiveThread() {
  const title = renameDraft.value.trim();
  if (!title) {
    return;
  }
  try {
    await threadList.renameThread({ threadId: threadId.value, title });
    renameDraft.value = "";
    renameErrorMessage.value = null;
  } catch (error) {
    renameErrorMessage.value = error instanceof Error ? error.message : "重命名对话失败。";
  }
}

async function refreshActiveGoal() {
  await refreshGoal();
}

async function submitGoal() {
  const objective = goalDraft.value.trim();
  if (!objective) {
    goalDraft.value = "";
    return;
  }
  await saveGoal(objective);
  goalDraft.value = "";
  await threadList.query.refetch();
}

async function clearActiveGoal() {
  await clearGoal();
  goalDraft.value = "";
  await threadList.query.refetch();
}

async function compactActiveThread() {
  const result = await compactThread();
  if (result) {
    await history.query.refetch();
    await threadList.query.refetch();
  }
}

async function copySelectedArtifactLink() {
  if (!selectedArtifactViewer.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(selectedArtifactViewer.value.artifactUrl);
    artifactCopyMessage.value = "产物链接已复制。";
  } catch {
    artifactCopyMessage.value = "无法复制产物链接。";
  }
}

async function copySelectedArtifactCode() {
  const content = artifactContent.content.value;
  if (content === null) {
    return;
  }
  try {
    await navigator.clipboard.writeText(content);
    artifactCodeCopyMessage.value = "产物源码已复制。";
  } catch {
    artifactCodeCopyMessage.value = "无法复制产物源码。";
  }
}

function selectArtifactForPreview(artifact: string) {
  artifactCopyMessage.value = null;
  artifactCodeCopyMessage.value = null;
  artifactSkillInstallMessage.value = null;
  artifactSkillInstallError.value = null;
  selectArtifact(artifact);
}

function selectArtifactFromDetail(event: Event) {
  const value = eventTargetValue(event);
  if (!value) {
    return;
  }
  selectArtifactForPreview(value);
}

function setArtifactHtmlPreviewUrl(content: string) {
  revokeArtifactHtmlPreviewUrl();
  if (typeof URL.createObjectURL === "function") {
    artifactHtmlPreviewUrl.value = URL.createObjectURL(
      new Blob([content], { type: "text/html;charset=utf-8" }),
    );
    return;
  }
  artifactHtmlPreviewUrl.value = `data:text/html;charset=utf-8,${encodeURIComponent(content)}`;
}

async function buildArtifactHtmlPreview({
  abortController,
  isCancelled,
  scrollKey,
  sourceContent,
  sourceUrl,
}: {
  abortController: AbortController;
  isCancelled: () => boolean;
  scrollKey: string;
  sourceContent: string;
  sourceUrl: string | null | undefined;
}) {
  try {
    const resourceUrlMap = new Map<string, string>();
    const resourceUrls = [
      ...new Set(
        collectHtmlPreviewResourceUrls(sourceContent)
          .map((value) =>
            resolveHtmlPreviewResourceReference({
              url: sourceUrl,
              value,
            }),
          )
          .filter(shouldInlineArtifactHtmlPreviewResource),
      ),
    ];

    await Promise.all(
      resourceUrls.map(async (resourceUrl) => {
        try {
          const response = await fetch(resourceUrl, {
            credentials: "include",
            signal: abortController.signal,
          });
          if (!response.ok) {
            return;
          }
          resourceUrlMap.set(resourceUrl, await blobToDataUrl(await response.blob()));
        } catch (error) {
          if (!abortController.signal.aborted) {
            console.warn("Failed to inline HTML preview resource", error);
          }
        }
      }),
    );

    if (isCancelled()) {
      return;
    }

    const rewrittenContent = rewriteHtmlPreviewResourceUrls({
      content: sourceContent,
      resourceUrlMap,
      url: sourceUrl,
    });
    setArtifactHtmlPreviewUrl(
      appendHtmlPreviewScrollRestoration(rewrittenContent, scrollKey),
    );
    artifactHtmlPreviewErrorMessage.value = null;
  } catch (error) {
    if (abortController.signal.aborted || isCancelled()) {
      return;
    }
    revokeArtifactHtmlPreviewUrl();
    artifactHtmlPreviewErrorMessage.value = error instanceof Error
      ? error.message
      : "无法构建 HTML 预览。";
  }
}

function revokeArtifactHtmlPreviewUrl() {
  const currentUrl = artifactHtmlPreviewUrl.value;
  if (currentUrl?.startsWith("blob:") && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(currentUrl);
  }
  artifactHtmlPreviewUrl.value = null;
}

function handleArtifactHtmlPreviewMessage(event: MessageEvent) {
  if (event.source !== artifactHtmlPreviewIframe.value?.contentWindow) {
    return;
  }
  if (!isArtifactHtmlPreviewScrollMessage(event.data, artifactHtmlPreviewScrollKey.value)) {
    return;
  }

  if (event.data.type === "save") {
    const x = scrollCoordinate(event.data.x);
    const y = scrollCoordinate(event.data.y);
    if (x !== undefined && y !== undefined) {
      artifactHtmlPreviewScrollPosition.value = { x, y };
    }
    return;
  }

  artifactHtmlPreviewIframe.value?.contentWindow?.postMessage(
    {
      source: HTML_PREVIEW_SCROLL_MESSAGE_SOURCE,
      key: artifactHtmlPreviewScrollKey.value,
      type: "restore",
      ...artifactHtmlPreviewScrollPosition.value,
    },
    "*",
  );
}

function isArtifactHtmlPreviewScrollMessage(
  data: unknown,
  key: string,
): data is {
  source: typeof HTML_PREVIEW_SCROLL_MESSAGE_SOURCE;
  key: string;
  type: "save" | "restore-request";
  x?: unknown;
  y?: unknown;
} {
  return (
    typeof data === "object"
    && data !== null
    && "source" in data
    && data.source === HTML_PREVIEW_SCROLL_MESSAGE_SOURCE
    && "key" in data
    && data.key === key
    && "type" in data
    && (data.type === "save" || data.type === "restore-request")
  );
}

function scrollCoordinate(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function shouldInlineArtifactHtmlPreviewResource(resourceUrl: string): boolean {
  try {
    const parsed = new URL(resourceUrl, globalThis.location?.href);
    if (parsed.origin !== globalThis.location?.origin) {
      return false;
    }
    return (
      /^\/api\/threads\/[^/]+\/artifacts\//.test(parsed.pathname)
      || /^\/mock\/api\/threads\/[^/]+\/artifacts\//.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof blob.arrayBuffer === "function" && typeof btoa === "function") {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("无法读取 HTML 预览资源。"));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("无法读取 HTML 预览资源。"));
    };
    reader.readAsDataURL(blob);
  });
}

async function installSelectedArtifactSkill() {
  const path = selectedArtifact.value;
  if (!path || !canInstallSelectedArtifactSkill.value || isInstallingArtifactSkill.value) {
    return;
  }
  artifactSkillInstallMessage.value = null;
  artifactSkillInstallError.value = null;
  isInstallingArtifactSkill.value = true;
  try {
    const result = await installSkill({
      path,
      thread_id: threadId.value,
    });
    artifactSkillInstallMessage.value = result.message || `已安装 ${result.skill_name}。`;
  } catch (error) {
    artifactSkillInstallError.value = error instanceof Error
      ? error.message
      : "无法安装技能产物。";
  } finally {
    isInstallingArtifactSkill.value = false;
  }
}

function updateModelName(value: string) {
  updateLocalThreadContext({ model_name: value.trim() || undefined });
}

function updateMode(event: Event) {
  const value = eventTargetValue(event);
  updateLocalThreadContext({ mode: isThreadMode(value) ? value : undefined });
}

function updateReasoningEffort(event: Event) {
  const value = eventTargetValue(event);
  updateLocalThreadContext({
    reasoning_effort: isReasoningEffort(value) ? value : undefined,
  });
}

function updateThinkingEnabled(event: Event) {
  updateLocalThreadContext({ thinking_enabled: eventTargetChecked(event) });
}

function updateSubagentEnabled(event: Event) {
  updateLocalThreadContext({ subagent_enabled: eventTargetChecked(event) });
}

async function togglePinned(threadIdToPin: string, pinned: boolean) {
  await threadList.pinThread({ pinned: !pinned, threadId: threadIdToPin });
}

async function toggleActivePinned() {
  const thread = currentThread.value;
  if (!thread) {
    return;
  }
  await togglePinned(thread.thread_id, threadList.isThreadPinned(thread));
}

async function removeThread(threadIdToDelete: string) {
  await threadList.deleteThread({ threadId: threadIdToDelete });
  const nextPath = pathAfterDeletingThread({
    context: threadRunContext.value,
    createThreadId: createId,
    currentThreadId: threadId.value,
    deletedThreadId: threadIdToDelete,
  });
  if (nextPath) {
    await router.push(nextPath);
  }
}

async function loadMoreHistory() {
  await history.loadMore();
}

async function loadMoreThreads() {
  await threadList.loadMoreThreads();
}

function routeParamString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildRunContext(
  context: Record<string, unknown>,
  routeAgentName: string | undefined,
): Record<string, unknown> | undefined {
  const next = {
    ...context,
    ...(routeAgentName ? { agent_name: routeAgentName } : {}),
  };
  return Object.keys(next).length > 0 ? next : undefined;
}

function eventTargetValue(event: Event): string {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement
    ? target.value.trim()
    : "";
}

function eventTargetChecked(event: Event): boolean {
  const target = event.target;
  return target instanceof HTMLInputElement ? target.checked : false;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function isThreadMode(value: string): value is ThreadMode {
  return value === "flash" || value === "thinking" || value === "pro" || value === "ultra";
}

function isReasoningEffort(
  value: string,
): value is "minimal" | "low" | "medium" | "high" {
  return value === "minimal" || value === "low" || value === "medium" || value === "high";
}

function isSkillArchiveArtifact(filepath: string): boolean {
  const filename = artifactFilename(filepath).toLocaleLowerCase();
  return filename.endsWith(".zip") || filename.endsWith(".skill");
}

</script>

<template>
  <main class="workspace-page workspace-shell">
    <a class="workspace-nav-shell__skip" href="#workspace-chat-content">
      跳过对话列表
    </a>
    <aside class="workspace-sidebar" data-testid="vue-thread-list" aria-label="对话列表">
      <div class="workspace-sidebar__header">
        <h2>对话</h2>
        <a-button
          type="primary"
          size="small"
          :disabled="threadList.isCreatingThread.value"
          :loading="threadList.isCreatingThread.value"
          data-testid="vue-thread-create"
          @click="createNewThread"
        >
          新建
        </a-button>
      </div>

      <a-spin v-if="isThreadListLoading" role="status" />
      <nav v-else class="workspace-sidebar__list">
        <a-alert
          v-if="threadActionErrorMessage"
          data-testid="vue-thread-action-error"
          role="alert"
          type="error"
          show-icon
          :message="threadActionErrorMessage"
        />
        <div
          v-for="thread in threads"
          :key="thread.thread_id"
          class="workspace-sidebar__item"
          :class="{ 'workspace-sidebar__item--active': thread.thread_id === threadId }"
          :data-testid="`vue-thread-list-item-${thread.thread_id}`"
        >
          <NuxtLink
            class="workspace-sidebar__link"
            :to="threadList.pathOfThread(thread)"
            :aria-current="thread.thread_id === threadId ? 'page' : undefined"
          >
            <span>{{ threadList.titleOfThread(thread) }}</span>
            <small>
              {{ thread.status }}
              <template v-if="threadList.channelSourceOfThread(thread)">
                · {{ threadList.channelSourceOfThread(thread)?.label }}
              </template>
            </small>
          </NuxtLink>
          <div class="workspace-sidebar__actions">
            <a-button
              size="small"
              :disabled="threadList.isPinningThread.value"
              :data-testid="`vue-thread-pin-${thread.thread_id}`"
              @click="togglePinned(thread.thread_id, threadList.isThreadPinned(thread))"
            >
              {{ threadList.isThreadPinned(thread) ? "取消置顶" : "置顶" }}
            </a-button>
            <a-button
              danger
              size="small"
              :disabled="threadList.isDeletingThread.value"
              :data-testid="`vue-thread-delete-${thread.thread_id}`"
              @click="removeThread(thread.thread_id)"
            >
              删除
            </a-button>
          </div>
        </div>
        <a-button
          v-if="threadListHasMore"
          :loading="threadListIsLoadingMore"
          data-testid="vue-thread-list-load-more"
          @click="loadMoreThreads"
        >
          加载更早对话
        </a-button>
      </nav>
    </aside>

    <section id="workspace-chat-content" class="workspace-chat" tabindex="-1">
      <header class="workspace-chat__header">
        <div>
          <p class="workspace-chat__eyebrow">工作区对话</p>
          <h1>{{ activeThreadTitle }}</h1>
        </div>
        <div class="workspace-chat__header-actions">
          <a-button
            v-if="currentThread"
            :disabled="threadList.isPinningThread.value"
            @click="toggleActivePinned"
          >
            {{ activeThreadPinned ? "取消置顶" : "置顶" }}
          </a-button>
          <a-button
            v-if="currentThread"
            :disabled="isBusy || isCompacting || !canCompactThread"
            :loading="isCompacting"
            data-testid="vue-chat-compact"
            @click="compactActiveThread"
          >
            压缩上下文
          </a-button>
          <a-button
            v-if="isBusy"
            danger
            :loading="status === 'stopping'"
            data-testid="vue-chat-stop"
            @click="stopStream"
          >
            停止
          </a-button>
        </div>
      </header>

      <section
        class="workspace-chat__status"
        data-testid="vue-thread-stream-status"
        role="status"
        aria-live="polite"
      >
        <span>{{ viewModel.status }}</span>
        <span>运行：{{ viewModel.runId || "无" }}</span>
        <span>游标：{{ viewModel.cursor || "无" }}</span>
        <span>消息：{{ viewModel.messageCount }}</span>
        <span>子任务：{{ viewModel.subtasks.length }}</span>
        <span>缺口：{{ viewModel.gapCount }}</span>
      </section>

      <section class="workspace-settings" data-testid="vue-thread-settings">
        <div class="workspace-settings__header">
          <h2>设置</h2>
          <a-button size="small" data-testid="vue-thread-settings-reset" @click="resetLocalThreadContext">
            重置
          </a-button>
        </div>
        <label class="workspace-settings__field">
          <span>模型</span>
          <a-input
            :value="effectiveContext.model_name"
            placeholder="默认模型"
            data-testid="vue-thread-settings-model"
            @update:value="updateModelName"
          />
        </label>
        <label class="workspace-settings__field">
          <span>模式</span>
          <select
            :value="effectiveContext.mode || ''"
            data-testid="vue-thread-settings-mode"
            @change="updateMode"
          >
            <option value="" />
            <option value="flash">快速</option>
            <option value="thinking">深度思考</option>
            <option value="pro">Pro</option>
            <option value="ultra">Ultra</option>
          </select>
        </label>
        <label class="workspace-settings__field">
          <span>推理强度</span>
          <select
            :value="effectiveContext.reasoning_effort || ''"
            data-testid="vue-thread-settings-reasoning"
            @change="updateReasoningEffort"
          >
            <option value="" />
            <option value="minimal">极低</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </label>
        <label class="workspace-settings__check">
          <input
            type="checkbox"
            :checked="effectiveContext.thinking_enabled === true"
            data-testid="vue-thread-settings-thinking"
            @change="updateThinkingEnabled"
          >
          <span>启用思考</span>
        </label>
        <label class="workspace-settings__check">
          <input
            type="checkbox"
            :checked="effectiveContext.subagent_enabled === true"
            data-testid="vue-thread-settings-subagent"
            @change="updateSubagentEnabled"
          >
          <span>启用子智能体</span>
        </label>
      </section>

      <a-alert
        v-if="errorMessage"
        class="workspace-chat__alert"
        role="alert"
        type="error"
        show-icon
        :message="errorMessage"
      />
      <a-alert
        v-if="viewModel.gapCount > 0"
        class="workspace-chat__alert"
        data-testid="vue-stream-gap-warning"
        role="status"
        type="warning"
        show-icon
        message="检测到流式回放缺口，已重新加载历史。"
      />
      <a-alert
        v-if="compactErrorMessage"
        class="workspace-chat__alert"
        data-testid="vue-compact-error"
        role="alert"
        type="error"
        show-icon
        :message="compactErrorMessage"
      />
      <a-alert
        v-if="compactNoticeMessage"
        class="workspace-chat__alert"
        data-testid="vue-compact-notice"
        role="status"
        type="info"
        show-icon
        :message="compactNoticeMessage"
      />

      <section class="workspace-goal" data-testid="vue-goal-status">
        <div class="workspace-goal__header">
          <h2>目标</h2>
          <div class="workspace-goal__actions">
            <a-button
              size="small"
              :loading="isGoalPending"
              data-testid="vue-goal-refresh"
              @click="refreshActiveGoal"
            >
              刷新
            </a-button>
            <a-button
              size="small"
              danger
              :disabled="!hasGoal || isGoalPending"
              data-testid="vue-goal-clear"
              @click="clearActiveGoal"
            >
              清除
            </a-button>
          </div>
        </div>
        <a-alert
          v-if="goalErrorMessage"
          data-testid="vue-goal-error"
          role="alert"
          type="error"
          show-icon
          :message="goalErrorMessage"
        />
        <p v-if="activeGoal" class="workspace-goal__objective" data-testid="vue-goal-objective">
          {{ activeGoal.objective }}
        </p>
        <p v-else class="workspace-goal__empty">暂无活动目标。</p>
        <small
          v-if="goalContinuation"
          class="workspace-goal__continuation"
          data-testid="vue-goal-continuation"
        >
          继续执行 {{ goalContinuation.count }}/{{ goalContinuation.max }}
        </small>
        <form class="workspace-goal__form" @submit.prevent="submitGoal">
          <a-input
            v-model:value="goalDraft"
            placeholder="设置目标"
            data-testid="vue-goal-input"
          />
          <a-button
            html-type="submit"
            type="primary"
            :disabled="!goalDraft.trim() || isGoalPending"
            :loading="isGoalPending"
            data-testid="vue-goal-submit"
          >
            设置
          </a-button>
        </form>
      </section>

      <form class="workspace-chat__rename" aria-label="重命名当前对话" @submit.prevent="renameActiveThread">
        <a-alert
          v-if="renameErrorMessage"
          data-testid="vue-thread-rename-error"
          role="alert"
          type="error"
          show-icon
          :message="renameErrorMessage"
        />
        <a-input
          v-model:value="renameDraft"
          placeholder="重命名对话"
          data-testid="vue-thread-rename-input"
        />
        <a-button
          html-type="submit"
          :disabled="!renameDraft.trim() || threadList.isRenamingThread.value"
          :loading="threadList.isRenamingThread.value"
          data-testid="vue-thread-rename-submit"
        >
          重命名
        </a-button>
        <a-button
          danger
          :disabled="threadList.isDeletingThread.value"
          @click="removeThread(threadId)"
        >
          删除
        </a-button>
      </form>

      <form class="workspace-chat__composer" aria-label="发送对话消息" @submit.prevent="submitMessage">
        <a-textarea
          v-model:value="draft"
          :auto-size="{ minRows: 4, maxRows: 8 }"
          aria-label="消息输入"
          placeholder="向 DeerFlow 提问..."
          data-testid="vue-chat-input"
        />
        <a-button
          type="primary"
          html-type="submit"
          :disabled="!draft.trim() || isBusy"
          data-testid="vue-chat-send"
        >
          发送
        </a-button>
      </form>

      <section class="workspace-chat__messages" data-testid="vue-thread-stream-messages" aria-label="对话消息">
        <a-button v-if="historyHasMore" :loading="historyIsLoading" @click="loadMoreHistory">
          加载更多
        </a-button>
        <MessageList
          :artifact-paths="artifacts"
          :disabled="isBusy"
          :is-streaming="isStreaming"
          :messages="viewModel.messages"
          :thread-id="threadId"
          @submit-human-input="submitHumanInput"
        />
      </section>

      <section class="workspace-artifacts" data-testid="vue-artifact-panel">
        <div class="workspace-artifacts__header">
          <h2>产物</h2>
          <a-button
            size="small"
            :disabled="artifacts.length === 0"
            :aria-controls="artifactPanelOpen ? 'vue-artifact-panel-body' : undefined"
            :aria-expanded="artifactPanelOpen"
            data-testid="vue-artifact-toggle"
            @click="setArtifactPanelOpen(!artifactPanelOpen)"
          >
            {{ artifactPanelOpen ? "隐藏" : "显示" }}
          </a-button>
        </div>
        <div
          v-if="artifactPanelOpen"
          id="vue-artifact-panel-body"
          class="workspace-artifacts__body"
          data-testid="vue-artifact-panel-body"
        >
          <a-empty v-if="artifacts.length === 0" description="暂无产物" />
          <ul v-else class="workspace-artifacts__list">
            <li v-for="artifact in artifacts" :key="artifact">
              <button
                type="button"
                class="workspace-artifacts__item"
                :class="{ 'workspace-artifacts__item--selected': artifact === selectedArtifact }"
                :data-testid="`vue-artifact-item-${artifactFilename(artifact)}`"
                :aria-current="artifact === selectedArtifact ? 'true' : undefined"
                @click="selectArtifactForPreview(artifact)"
              >
                <span>{{ artifactFilename(artifact) }}</span>
                <small>{{ artifact }}</small>
              </button>
            </li>
          </ul>
          <section
            v-if="selectedArtifactViewer"
            class="workspace-artifacts__selected"
            data-testid="vue-artifact-selected"
          >
            <header class="workspace-artifacts__selected-header">
              <div>
                <strong data-testid="vue-artifact-selected-filename">
                  {{ selectedArtifactViewer.filename }}
                </strong>
                <small data-testid="vue-artifact-selected-path">{{ selectedArtifact }}</small>
                <label class="workspace-artifacts__selected-picker">
                  <span>当前产物</span>
                  <select
                    :value="selectedArtifact ?? ''"
                    aria-label="切换当前产物"
                    data-testid="vue-artifact-detail-select"
                    @change="selectArtifactFromDetail"
                  >
                    <option v-for="artifact in artifacts" :key="artifact" :value="artifact">
                      {{ artifactFilename(artifact) }}
                    </option>
                  </select>
                </label>
              </div>
              <div class="workspace-artifacts__actions">
                <a
                  class="workspace-button workspace-button--ghost"
                  data-testid="vue-artifact-open"
                  :href="selectedArtifactViewer.artifactUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  打开
                </a>
                <a
                  class="workspace-button"
                  data-testid="vue-artifact-download"
                  :download="selectedArtifactViewer.downloadFilename"
                  :href="selectedArtifactViewer.downloadUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  下载
                </a>
                <button
                  class="workspace-button"
                  data-testid="vue-artifact-copy"
                  type="button"
                  @click="copySelectedArtifactLink"
                >
                  复制链接
                </button>
                <button
                  class="workspace-button workspace-button--ghost"
                  data-testid="vue-artifact-close"
                  type="button"
                  @click="setArtifactPanelOpen(false)"
                >
                  关闭
                </button>
                <button
                  v-if="canInstallSelectedArtifactSkill"
                  class="workspace-button"
                  data-testid="vue-artifact-install-skill"
                  type="button"
                  :disabled="isInstallingArtifactSkill"
                  @click="installSelectedArtifactSkill"
                >
                  {{ isInstallingArtifactSkill ? "正在安装..." : "安装技能" }}
                </button>
              </div>
            </header>
            <p
              v-if="artifactCopyMessage"
              class="workspace-artifacts__copy-status"
              data-testid="vue-artifact-copy-status"
              role="status"
            >
              {{ artifactCopyMessage }}
            </p>
            <p
              v-if="artifactSkillInstallMessage"
              class="workspace-artifacts__copy-status"
              data-testid="vue-artifact-install-skill-status"
              role="status"
            >
              {{ artifactSkillInstallMessage }}
            </p>
            <a-alert
              v-if="artifactSkillInstallError"
              data-testid="vue-artifact-install-skill-error"
              role="alert"
              type="error"
              show-icon
              :message="artifactSkillInstallError"
            />
            <div
              v-if="selectedArtifactCanToggleView"
              class="workspace-artifacts__view-toggle"
              data-testid="vue-artifact-view-toggle"
            >
              <button
                type="button"
                class="workspace-button"
                :class="{ 'workspace-button--active': artifactViewMode === 'preview' }"
                :aria-pressed="artifactViewMode === 'preview'"
                data-testid="vue-artifact-view-preview"
                @click="artifactViewMode = 'preview'"
              >
                预览
              </button>
              <button
                type="button"
                class="workspace-button"
                :class="{ 'workspace-button--active': artifactViewMode === 'code' }"
                :aria-pressed="artifactViewMode === 'code'"
                data-testid="vue-artifact-view-code"
                @click="artifactViewMode = 'code'"
              >
                源码
              </button>
            </div>
            <div
              v-if="selectedArtifactViewer.canPreview"
              class="workspace-artifacts__preview"
              data-testid="vue-artifact-preview"
            >
              <img
                v-if="artifactViewMode === 'preview' && selectedArtifactViewer.previewKind === 'image'"
                :alt="selectedArtifactViewer.filename"
                :src="selectedArtifactViewer.artifactUrl"
              >
              <audio
                v-else-if="artifactViewMode === 'preview' && selectedArtifactViewer.previewKind === 'audio'"
                :aria-label="selectedArtifactViewer.filename"
                controls
                preload="metadata"
                :src="selectedArtifactViewer.artifactUrl"
              />
              <video
                v-else-if="artifactViewMode === 'preview' && selectedArtifactViewer.previewKind === 'video'"
                :aria-label="selectedArtifactViewer.filename"
                controls
                playsinline
                preload="metadata"
                :src="selectedArtifactViewer.artifactUrl"
              />
              <iframe
                v-else-if="artifactViewMode === 'preview' && selectedArtifactViewer.previewKind === 'iframe'"
                :title="`${selectedArtifactViewer.filename} preview`"
                sandbox=""
                :src="selectedArtifactViewer.artifactUrl"
              />
              <iframe
                v-else-if="artifactViewMode === 'preview' && selectedArtifactViewer.previewKind === 'html' && artifactHtmlPreviewUrl"
                ref="artifactHtmlPreviewIframe"
                data-testid="vue-artifact-html-blob-preview"
                :title="`${selectedArtifactViewer.filename} preview`"
                sandbox="allow-scripts allow-forms"
                :src="artifactHtmlPreviewUrl"
              />
              <div
                v-else-if="artifactViewMode === 'preview' && selectedArtifactViewer.previewKind === 'markdown'"
                class="workspace-artifacts__markdown-preview"
                data-testid="vue-artifact-markdown-preview"
              >
                <RichMessageContent
                  v-if="artifactContent.content.value !== null"
                  :artifact-paths="artifacts"
                  :content="artifactContent.content.value"
                  :thread-id="threadId"
                />
                <span
                  v-else-if="artifactContent.isLoading.value"
                  data-testid="vue-artifact-markdown-loading"
                >
                  正在加载 {{ selectedArtifactViewer.filename }}...
                </span>
                <span
                  v-else-if="artifactContent.errorMessage.value"
                  data-testid="vue-artifact-markdown-error"
                >
                  {{ artifactContent.errorMessage.value }}
                </span>
              </div>
              <span
                v-else-if="artifactViewMode === 'preview' && selectedArtifactViewer.previewKind === 'html' && artifactContent.isLoading.value"
                data-testid="vue-artifact-html-loading"
              >
                  正在加载 {{ selectedArtifactViewer.filename }}...
              </span>
              <span
                v-else-if="artifactViewMode === 'preview' && selectedArtifactViewer.previewKind === 'html' && (artifactHtmlPreviewErrorMessage || artifactContent.errorMessage.value)"
                data-testid="vue-artifact-html-error"
              >
                {{ artifactHtmlPreviewErrorMessage || artifactContent.errorMessage.value }}
              </span>
              <p
                v-if="artifactViewMode === 'preview' && selectedArtifactViewer.previewKind !== 'code'"
                class="workspace-artifacts__preview-note"
                data-testid="vue-artifact-preview-description"
              >
                {{ selectedArtifactViewer.previewDescription }}
              </p>
              <div
                v-if="artifactViewMode === 'preview' && selectedArtifactViewer.previewKind !== 'code'"
                class="workspace-artifacts__preview-fallback"
                data-testid="vue-artifact-preview-fallback"
              >
                <strong>{{ selectedArtifactViewer.extensionLabel }} 兜底</strong>
                <span>{{ selectedArtifactViewer.fallbackDescription }}</span>
              </div>
              <div
                v-else-if="artifactViewMode === 'code' && selectedArtifactCanShowCode"
                class="workspace-artifacts__code-viewer"
                data-testid="vue-artifact-code-viewer"
              >
                <header class="workspace-artifacts__code-header">
                  <strong>{{ selectedArtifactViewer.filename }}</strong>
                  <span data-testid="vue-artifact-code-language">
                    {{ selectedArtifactCodeLanguage }}
                  </span>
                  <small
                    v-if="selectedArtifactCodeLineCount > 0"
                    data-testid="vue-artifact-code-line-count"
                  >
                    {{ selectedArtifactCodeLineCount }} 行
                  </small>
                  <button
                    class="workspace-button"
                    type="button"
                    :disabled="artifactContent.content.value === null"
                    data-testid="vue-artifact-copy-code"
                    @click="copySelectedArtifactCode"
                  >
                    复制源码
                  </button>
                  <small
                    v-if="artifactCodeCopyMessage"
                    data-testid="vue-artifact-copy-code-status"
                    role="status"
                  >
                    {{ artifactCodeCopyMessage }}
                  </small>
                </header>
                <div
                  class="workspace-artifacts__code-preview"
                  data-testid="vue-artifact-code-preview"
                >
                  <ArtifactCodeViewer
                    v-if="artifactContent.content.value !== null"
                    :code="artifactContent.content.value"
                    :filename="selectedArtifactViewer.filename"
                    :language="selectedArtifactCodeLanguage"
                  />
                  <span
                    v-else-if="artifactContent.isLoading.value"
                    data-testid="vue-artifact-code-loading"
                    role="status"
                  >
                    正在加载 {{ selectedArtifactViewer.filename }}...
                  </span>
                  <span
                    v-else-if="artifactContent.errorMessage.value"
                    data-testid="vue-artifact-code-error"
                    role="alert"
                  >
                    {{ artifactContent.errorMessage.value }}
                  </span>
                  <span v-else>{{ selectedArtifactViewer.artifactUrl }}</span>
                </div>
              </div>
            </div>
            <div
              v-else
              class="workspace-artifacts__fallback"
              data-testid="vue-artifact-download-fallback"
            >
              <strong>{{ selectedArtifactViewer.filename }}</strong>
              <span>{{ selectedArtifactViewer.extensionLabel }} file</span>
              <p>{{ selectedArtifactViewer.fallbackDescription }}</p>
            </div>
          </section>
        </div>
      </section>

      <pre class="workspace-chat__snapshot" data-testid="vue-thread-stream-snapshot">{{
        JSON.stringify(viewModel, null, 2)
      }}</pre>
    </section>
  </main>
</template>
