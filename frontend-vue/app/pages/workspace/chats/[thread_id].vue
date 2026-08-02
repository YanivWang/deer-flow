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
import type { ChannelProvider, ChannelRuntimeConfigValues } from "../../../core/api/channels/client";
import type { ThreadMode } from "../../../core/settings/local";
import { readWorkspacePreferences } from "../../../core/settings/preferences";
import { createId } from "../../../core/utils/id";
import { extractToolRichCards } from "../../../core/messages/tool-cards";

const route = useRoute();
const router = useRouter();
const { locale, t } = useAppI18n();
const draft = ref("");
const selectedSlashSkill = ref<string | null>(null);
const mobileSidebarOpen = ref(true);
const channelsMenuOpen = ref(false);
const channelSetupProvider = ref<ChannelProvider | null>(null);
const channelSetupValues = ref<ChannelRuntimeConfigValues>({});
const channelActionMessage = ref("");
const channelProviderSnapshots = ref<Record<string, ChannelProvider>>({});
const goalDraft = ref("");
const goalCommandObjective = useState("vue-goal-command-objective", () => "");
const goalCommandThreadId = useState<string | null>("vue-goal-command-thread-id", () => null);
const renameDraft = ref("");
const renameErrorMessage = ref<string | null>(null);
const editingMessageId = ref<string | null>(null);
const sideChatMessageId = ref<string | null>(null);
type SidecarReference = { label: string; messageId?: string; role: "user" | "assistant"; content: string };
const conversationReferences = ref<SidecarReference[]>([]);
const sidecarReferences = ref<SidecarReference[]>([]);
const sidecarOpen = ref(false);
const sidecarThreadId = ref<string | null>(null);
const sidecarMessages = ref<Array<{ role: string; content: string; id?: string }>>([]);
const sidecarDraft = ref("");
const sidecarModel = ref("DeepSeek V4 Pro");
const sidecarMode = ref("Pro");
const sidecarModeMenuOpen = ref(false);
const sidecarModelMenuOpen = ref(false);
const sidecarDeleteOpen = ref(false);
const sidecarDeleting = ref(false);
const sidecarSelectionText = ref("");
const sidecarSelectionMessageId = ref<string | undefined>();
const sidecarMessageScroll = ref<HTMLElement | null>(null);
const attachmentInput = ref<HTMLInputElement | null>(null);
const attachmentTooltipVisible = ref(false);
const uploadLimits = ref({ max_files: 10, max_file_size: 50 * 1024 * 1024, max_total_size: 100 * 1024 * 1024 });
const attachments = ref<Array<{ file: File; uploaded?: { filename: string; size: number; path: string; virtual_path: string; status: string } }>>([]);
const attachmentErrorMessage = ref("");
const isUploadingAttachments = ref(false);
const polishingInput = ref(false);
const polishUndo = ref<{ originalText: string; rewrittenText: string } | null>(null);
const polishController = ref<AbortController | null>(null);
const promptHistoryIndex = ref<number | null>(null);
const promptHistoryDraft = ref("");
const skillSuggestionIndex = ref(0);
const sidebarMenuThreadId = ref<string | null>(null);
const lastNotifiedRunId = ref<string | null>(null);
const historyPaginationLoading = ref(false);
const historyLoadMoreSentinel = ref<HTMLElement | null>(null);
let historyLoadMoreObserver: IntersectionObserver | null = null;
const historySyncBlocked = ref(false);
const artifactPanelWidth = ref(32);
const artifactRestoreWidth = ref(32);
const artifactPanelDragging = ref(false);
const artifactDragStartX = ref(0);
const artifactDragStartWidth = ref(32);
const artifactDiscoveryInitialized = ref(false);
const threadId = computed(() => String(route.params.thread_id ?? ""));
const isStaticMockDemo = computed(() => route.query.mock === "true" && threadId.value === "7cfa5f8f-a2f8-47ad-acbd-da7137baf990");
const agentsFeature = useAgentsApiEnabled({ enabled: threadId.value === "new" });
const browserFeature = useBrowserControlEnabled();
const channelSettings = useChannelSettings(true);
const visibleChannelProviders = computed(() =>
  channelSettings.providers.value.filter((provider) => provider.enabled),
);
const isWelcomeMode = computed(
  () => threadId.value === "new" && viewModel.value.messages.length === 0 && !isBusy.value,
);
const welcomeSuggestions = computed(() =>
  locale.value === "zh-CN"
    ? [
        { label: "写作", prompt: "撰写一篇关于[主题]的博客文章" },
        { label: "研究", prompt: "深入研究[主题]并总结发现" },
        { label: "收集", prompt: "从[来源]收集数据并创建报告" },
      ]
    : [
        { label: "Write", prompt: "Write a blog post about the latest trends on [topic]" },
        { label: "Research", prompt: "Conduct a deep dive research on [topic], and summarize the findings." },
        { label: "Collect", prompt: "Collect data from [source] and create a report." },
      ],
);
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
const sidebarThreads = computed(() =>
  threads.value.filter((thread) => thread.thread_id !== "new" && thread.metadata?.deerflow_sidecar !== true),
);
const restoredSidecarThread = computed(() =>
  threads.value.find((thread) => thread.metadata?.deerflow_sidecar === true && thread.metadata.parent_thread_id === threadId.value),
);
const hasSidecarConversation = computed(() => Boolean(sidecarThreadId.value || restoredSidecarThread.value));
watch(restoredSidecarThread, (thread) => {
  if (thread && !sidecarThreadId.value) {
    sidecarThreadId.value = thread.thread_id;
  }
});
watch(sidecarThreadId, (id) => {
  if (id) void loadSidecarMessages(id);
});
const currentThread = computed(() =>
  threads.value.find((thread) => thread.thread_id === threadId.value),
);
watch(
  [threadId, currentThread, () => threadList.query.isSuccess.value, () => threadList.query.isFetching.value],
  ([activeId, thread, isLoaded, isFetching]) => {
    if (activeId === "new" || !isLoaded || isFetching || thread) return;
    void router.replace(pathOfNewThreadForCurrentAgent());
  },
  { immediate: true },
);
watch(status, (nextStatus, previousStatus) => {
  if (
    nextStatus !== "completed" ||
    !["streaming", "recovering", "stopping"].includes(previousStatus)
  ) {
    return;
  }
  const runId = viewModel.value.runId;
  if (runId && lastNotifiedRunId.value === runId) {
    return;
  }
  const notificationApi = typeof window !== "undefined" ? window.Notification : undefined;
  if (
    !notificationApi ||
    notificationApi.permission !== "granted" ||
    document.hasFocus() ||
    !readWorkspacePreferences().notification.enabled
  ) {
    return;
  }
  const response = [...viewModel.value.messages]
    .reverse()
    .find((message) => message.role === "ai" && message.content.trim())?.content.trim();
  if (!response) {
    return;
  }
  const title = currentThread.value
    ? displaySidebarThreadTitle(currentThread.value)
    : threadId.value === "new" ? "New Chat" : threadId.value;
  new notificationApi(title, { body: response });
  lastNotifiedRunId.value = runId ?? title;
});
const artifactPathname = computed(() => route.path);
const discoveredArtifacts = computed(() => [
  ...(currentThread.value?.values.artifacts ?? []),
  ...(viewModel.value.artifacts ?? []).filter((artifact): artifact is string => typeof artifact === "string"),
  ...viewModel.value.messages.flatMap((message) =>
    extractToolRichCards(message.raw).flatMap((card) => card.artifactPaths),
  ),
]);
const retainedArtifactPaths = ref<string[]>([]);
const artifactCandidates = computed(() => [
  ...retainedArtifactPaths.value,
  ...discoveredArtifacts.value,
].filter((path, index, paths): path is string =>
  typeof path === "string" && paths.indexOf(path) === index,
));
watch(artifactPathname, () => {
  retainedArtifactPaths.value = [];
  artifactDiscoveryInitialized.value = false;
});
watch(
  discoveredArtifacts,
  (nextArtifacts) => {
    const nextPaths = nextArtifacts.filter((path): path is string => typeof path === "string");
    if (nextPaths.length > 0) {
      retainedArtifactPaths.value = Array.from(
        new Set([...retainedArtifactPaths.value, ...nextPaths]),
      );
    }
  },
  { deep: true, immediate: true },
);
const {
  artifacts,
  open: artifactPanelOpen,
  selectArtifact,
  selectedArtifact,
  setOpen: setArtifactPanelOpen,
} = useArtifactPanel(artifactPathname, artifactCandidates);
const artifactDetailsVisible = ref(artifactPanelOpen.value);
watch(artifactPanelOpen, (isOpen) => {
  if (!isOpen) {
    artifactDetailsVisible.value = false;
  } else if (selectedArtifact.value) {
    artifactDetailsVisible.value = true;
  }
});

watch(
  artifactCandidates,
  (nextArtifacts, previousArtifacts) => {
    if (!artifactDiscoveryInitialized.value) {
      artifactDiscoveryInitialized.value = true;
      return;
    }
    if (
      isBusy.value &&
      nextArtifacts.length > (previousArtifacts?.length ?? 0) &&
      nextArtifacts.length > 0
    ) {
      artifactDetailsVisible.value = true;
      setArtifactPanelOpen(true);
    }
  },
  { deep: true },
);
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
const selectedArtifactDraftPreview = computed(() => {
  const artifactPath = selectedArtifact.value;
  if (!artifactPath) {
    return null;
  }
  return viewModel.value.messages
    .flatMap((message) => extractToolRichCards(message.raw))
    .find((card) => card.artifactPaths.includes(artifactPath))?.draftPreview ?? null;
});
const selectedArtifactPreviewContent = computed(
  () => selectedArtifactDraftPreview.value?.content ?? artifactContent.content.value,
);
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
const agentName = computed(() => routeParamString(route.params.agent_name) ?? null);
const skillSettings = useSkillSettings(true);
const enabledSkills = computed(() => skillSettings.skills.value.filter((skill) => skill.enabled));
const matchingSkills = computed(() => {
  const value = draft.value;
  if (!value.startsWith("/") || selectedSlashSkill.value) return [];
  const query = value.slice(1).toLowerCase();
  const builtins = query.startsWith("go") ? [{ name: "goal", enabled: true }] : [];
  return [...builtins, ...enabledSkills.value]
    .filter((skill) => skill.name.toLowerCase().startsWith(query));
});
watch(matchingSkills, () => {
  skillSuggestionIndex.value = 0;
});
const composerDraft = useComposerDraft({
  agentName,
  skillName: selectedSlashSkill,
  text: draft,
  threadId,
});
const serverThreadContext = computed(() => currentThread.value?.context ?? null);
const {
  effectiveContext,
  resetContext: resetLocalThreadContext,
  updateContext: updateLocalThreadContext,
} = useLocalThreadSettings(threadId, serverThreadContext);
const threadRunContext = computed(() =>
  buildRunContext(effectiveContext.value, agentName.value ?? undefined),
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
    if (isStaticMockDemo.value || historySyncBlocked.value) return;
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
  sidecarOpen.value = false;
  sidecarReferences.value = [];
  sidecarDraft.value = "";
  reset();
  setHistoryMessages([]);
  if (goalCommandThreadId.value !== nextThreadId) {
    goalCommandObjective.value = "";
    goalCommandThreadId.value = null;
  }
});

watch(
  () => route.fullPath,
  async (nextPath, previousPath) => {
    if (nextPath === previousPath) return;
    historySyncBlocked.value = true;
    reset();
    setHistoryMessages([]);
    draft.value = "";
    sidecarOpen.value = false;
    sidecarReferences.value = [];
    await nextTick();
    try {
      await history.query.refetch();
    } finally {
      historySyncBlocked.value = false;
      if (!isStaticMockDemo.value) {
        setHistoryMessages(history.messages.value);
      }
    }
  },
);

function displaySidebarThreadTitle(thread: Parameters<typeof threadList.titleOfThread>[0]): string {
  const title = threadList.titleOfThread(thread);
  return title === "Untitled" ? "New Chat" : title;
}

function goToNewChat() {
  reset();
  setHistoryMessages([]);
  draft.value = "";
  goalCommandObjective.value = "";
  goalCommandThreadId.value = null;
  sidecarOpen.value = false;
  sidecarReferences.value = [];
  void router.push(pathOfNewThreadForCurrentAgent());
}

function prepareForThreadNavigation(nextThreadId: string) {
  if (nextThreadId === threadId.value) return;
  reset();
  setHistoryMessages([]);
  sidecarOpen.value = false;
  sidecarReferences.value = [];
}

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
  const settings = route.query.settings;
  if (typeof settings === "string" && settings.length > 0) {
    void router.replace({
      path: "/workspace/settings",
      query: { settings },
    });
  }
  observeHistoryLoadMoreSentinel();
  if (isStaticMockDemo.value) {
    setHistoryMessages([
      { type: "human", id: "static-demo-human", content: [{ type: "text", text: "What might be the trends and opportunities in 2026?" }] },
      { type: "ai", id: "static-demo-ai", content: "I've created a modern, minimalist website showcasing the 2026 trends and opportunities analysis." },
    ]);
  }
});

watch(
  historyHasMore,
  async (hasMore) => {
    if (hasMore) {
      await nextTick();
      observeHistoryLoadMoreSentinel();
      if (typeof IntersectionObserver !== "undefined") {
        void loadHistoryFromSentinel();
      }
    }
  },
);

onBeforeUnmount(() => {
  window.removeEventListener("message", handleArtifactHtmlPreviewMessage);
  historyLoadMoreObserver?.disconnect();
  historyLoadMoreObserver = null;
  revokeArtifactHtmlPreviewUrl();
});

const activeThreadTitle = computed(() => {
  if (!currentThread.value) return threadId.value === "new" ? "New Chat" : threadId.value;
  return displaySidebarThreadTitle(currentThread.value);
});

const displayedGoalObjective = computed(
  () => activeGoal.value?.objective ?? goalCommandObjective.value,
);

async function submitMessage() {
  if (isBusy.value || polishingInput.value || isUploadingAttachments.value) {
    return;
  }

  const text = draft.value.trim();
  if (!text) {
    draft.value = "";
    return;
  }

  const goalObjective = text.startsWith("/goal ") ? text.slice("/goal ".length).trim() : "";
  if (/\[[^\]]+\]/.test(text)) {
    focusSuggestionPlaceholder();
    return;
  }
  const messageText = selectedSlashSkill.value ? `/${selectedSlashSkill.value} ${text}` : text;
  draft.value = "";
  selectedSlashSkill.value = null;
  composerDraft.clear();
  try {
    let activeThreadId = threadId.value;
    const isNewThread = activeThreadId === "new";
    if (isNewThread) {
      const created = await threadList.createThread({
        agentName: compactAgentName.value,
        threadId: createId(),
      });
      activeThreadId = created.thread_id;
    }
    if (goalObjective) {
      goalCommandThreadId.value = activeThreadId;
      await saveGoal(goalObjective, activeThreadId);
      goalCommandObjective.value = goalObjective;
    }
    if (goalObjective && isNewThread) {
      await router.replace(`/workspace/chats/${encodeURIComponent(activeThreadId)}`);
      await nextTick();
    }
    const context = threadRunContext.value;
    let uploadedFiles = attachments.value.map((item) => item.uploaded).filter((file): file is NonNullable<typeof file> => Boolean(file));
    if (attachments.value.some((item) => !item.uploaded)) {
      isUploadingAttachments.value = true;
      const formData = new FormData();
      for (const item of attachments.value) formData.append("files", item.file);
      const response = await fetch(`/api/threads/${encodeURIComponent(activeThreadId)}/uploads`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text() || "Upload failed");
      const result = await response.json() as { files?: Array<{ filename: string; size: number; path: string; virtual_path: string }> };
      uploadedFiles = (result.files ?? []).map((file) => ({
        filename: file.filename,
        size: file.size,
        path: file.virtual_path || file.path,
        virtual_path: file.virtual_path || file.path,
        status: "uploaded",
      }));
    }
    if (isNewThread && !goalObjective) {
      await router.replace(`/workspace/chats/${encodeURIComponent(activeThreadId)}`);
    }
    const filesForSubmit = uploadedFiles.map(({ filename, size, path, status }) => ({
      filename,
      size,
      path,
      status,
    }));
    await sendMessage({
      ...(context ? { context } : {}),
      ...(filesForSubmit.length > 0 ? { additionalKwargs: { files: filesForSubmit } } : {}),
      text: messageText,
      threadId: activeThreadId,
    });
    attachments.value = [];
    polishUndo.value = null;
    await history.query.refetch();
    if (goalObjective) {
      goalCommandObjective.value = goalObjective;
    }
    await threadList.query.refetch();
    if (goalObjective) {
      goalCommandObjective.value = goalObjective;
    }
  } catch {
    draft.value = text;
  } finally {
    isUploadingAttachments.value = false;
  }
}

async function loadUploadLimits() {
  try {
    const response = await fetch(`/api/threads/${encodeURIComponent(threadId.value)}/uploads/limits`, { credentials: "include" });
    if (response.ok) uploadLimits.value = await response.json();
  } catch {
    // The composer remains usable with conservative defaults.
  }
}

function formatUploadSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Number((bytes / 1024).toFixed(1))} KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${Number((bytes / (1024 * 1024)).toFixed(1))} MiB`;
  return `${Number((bytes / (1024 * 1024 * 1024)).toFixed(1))} GiB`;
}

function acceptAttachments(event: Event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const incoming = Array.from(input.files ?? []);
  let count = attachments.value.length;
  let total = attachments.value.reduce((sum, item) => sum + item.file.size, 0);
  const accepted: File[] = [];
  const rejected: string[] = [];
  for (const file of incoming) {
    if (file.size > uploadLimits.value.max_file_size || count >= uploadLimits.value.max_files || total + file.size > uploadLimits.value.max_total_size) {
      rejected.push(file.name);
      continue;
    }
    accepted.push(file);
    count += 1;
    total += file.size;
  }
  attachments.value = [...attachments.value, ...accepted.map((file) => ({ file }))];
  attachmentErrorMessage.value = rejected.length > 0
    ? `${rejected.join(", ")} 超出附件限制（${formatUploadSize(uploadLimits.value.max_total_size)}）。`
    : "";
  input.value = "";
}

function focusSuggestionPlaceholder() {
  nextTick(() => {
    const textarea = document.querySelector("textarea[name='message']");
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    const match = /\[([^\]]+)\]/.exec(textarea.value);
    if (!match || match.index === undefined) return;
    textarea.focus();
    textarea.setSelectionRange(match.index, match.index + match[0].length);
  });
}

async function polishDraft() {
  if (polishingInput.value) return;
  if (polishUndo.value && draft.value === polishUndo.value.rewrittenText) {
    draft.value = polishUndo.value.originalText;
    polishUndo.value = null;
    return;
  }
  if (!draft.value.trim()) return;
  const controller = new AbortController();
  polishController.value = controller;
  polishingInput.value = true;
  const originalText = draft.value;
  try {
    const response = await fetch("/api/input-polish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: originalText, thread_id: threadId.value }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Failed to polish input");
    const result = await response.json() as { rewritten_text?: string; changed?: boolean };
    if (result.changed && result.rewritten_text) {
      draft.value = result.rewritten_text;
      polishUndo.value = { originalText, rewrittenText: result.rewritten_text };
    }
  } catch {
    // Aborts intentionally leave the original draft untouched.
  } finally {
    if (polishController.value === controller) polishController.value = null;
    polishingInput.value = false;
  }
}

function cancelPolishDraft() {
  polishController.value?.abort();
  polishController.value = null;
  polishingInput.value = false;
}

function messageText(message: { content?: unknown }) {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) return String(part.text ?? "");
        return "";
      })
      .join("");
  }
  return "";
}

async function prepareRun(path: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/threads/${encodeURIComponent(threadId.value)}${path}`, {
    body: JSON.stringify(body),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error(await response.text() || `HTTP ${response.status}`);
  return (await response.json()) as {
    input: Record<string, unknown>;
    checkpoint: Record<string, unknown>;
    metadata: Record<string, unknown>;
  };
}

async function regenerateMessage(message: { id?: string }) {
  if (!message.id || isBusy.value) return;
  const prepared = await prepareRun("/runs/regenerate/prepare", { message_id: message.id });
  await sendMessage({
    checkpoint: prepared.checkpoint,
    context: { ...threadRunContext.value, agent_name: agentName.value ?? undefined, thread_id: threadId.value },
    input: prepared.input,
    metadata: prepared.metadata,
    text: "replay",
    threadId: threadId.value,
  });
  await history.query.refetch();
}

async function branchConversation(message: { id?: string }) {
  if (!message.id || isBusy.value) return;
  const response = await fetch(`/api/threads/${encodeURIComponent(threadId.value)}/branches`, {
    body: JSON.stringify({ message_id: message.id }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error(await response.text() || `HTTP ${response.status}`);
  const result = await response.json() as { thread_id?: string };
  if (result.thread_id) {
    await router.push(`/workspace/chats/${result.thread_id}`);
  }
}

function editMessage(message: { id?: string; content?: unknown }) {
  editingMessageId.value = message.id ?? null;
  draft.value = messageText(message);
}

async function updateAndRerunMessage() {
  const messageId = editingMessageId.value;
  const replacementText = draft.value.trim();
  if (!messageId || !replacementText || isBusy.value) return;
  const prepared = await prepareRun("/runs/edit-regenerate/prepare", {
    human_message_id: messageId,
    replacement_text: replacementText,
  });
  editingMessageId.value = null;
  draft.value = "";
  await sendMessage({
    checkpoint: prepared.checkpoint,
    context: { ...threadRunContext.value, agent_name: agentName.value ?? undefined, thread_id: threadId.value },
    input: prepared.input,
    metadata: prepared.metadata,
    text: "replay",
    threadId: threadId.value,
  });
  await history.query.refetch();
}

function addConversationReference(message: { id?: string; role?: string; content?: string }, selectedText: string, displayIndex: number) {
  const role = message.role === "human" || message.role === "user" ? "user" : "assistant";
  conversationReferences.value = [...conversationReferences.value, {
    label: `Selected ${role} text #${displayIndex}`,
    ...(message.id ? { messageId: message.id } : {}),
    role,
    content: selectedText,
  }];
}

function askInSideChat(message: { id?: string; role?: string; content?: string }, selectedText = "", displayIndex = 1) {
  sideChatMessageId.value = message.id ?? null;
  const role = message.role === "human" || message.role === "user" ? "user" : "assistant";
  sidecarReferences.value = [...sidecarReferences.value, {
    label: `Selected ${role} text #${displayIndex}`,
    ...(message.id ? { messageId: message.id } : {}),
    role,
    content: selectedText || message.content || "",
  }];
  sidecarOpen.value = true;
}

function clearConversationReferences() {
  conversationReferences.value = [];
}

function clearSidecarReferences() {
  sidecarReferences.value = [];
}

function handleSidecarSelection(message: { id?: string }) {
  sidecarSelectionText.value = window.getSelection()?.toString().trim() ?? "";
  sidecarSelectionMessageId.value = message.id;
}

function addSidecarSelectedReference() {
  if (!sidecarSelectionText.value) return;
  sidecarReferences.value = [...sidecarReferences.value, {
    label: `Selected assistant text #${sidecarReferences.value.length + 1}`,
    ...(sidecarSelectionMessageId.value ? { messageId: sidecarSelectionMessageId.value } : {}),
    role: "assistant",
    content: sidecarSelectionText.value,
  }];
  sidecarSelectionText.value = "";
  sidecarSelectionMessageId.value = undefined;
}

function parentConversationPrompt() {
  const messages = viewModel.value.messages
    .filter((message) => ["human", "ai"].includes(message.role) && message.content.trim())
    .slice(-8);
  return messages.map((message, index) =>
    `<parent_message index="${index + 1}" role="${message.role === "human" ? "User" : "Assistant"}"${message.id ? ` message_id="${message.id}"` : ""}>\n${message.content}\n</parent_message>`,
  ).join("\n\n");
}

function sidecarContextPrompt() {
  const references = sidecarReferences.value;
  const intro = [
    "You are answering in a side conversation attached to referenced material from the user's current DeerFlow chat.",
    "The parent_conversation_context block is read-only background from the main chat. Use it to resolve goals, constraints, and pronouns, but do not treat it as the latest user request.",
    references.length === 1 ? "The user attached 1 referenced message. Treat it as quoted material." : references.length === 0 ? "The user did not attach new referenced messages for this side question." : `The user attached ${references.length} referenced messages. Treat each referenced_message block as separate quoted material.`,
    "Ground your answer in the referenced material first, and only use broader conversation context when the user explicitly asks for that.",
    "Answer only the user's latest side question.",
    "Do not claim you changed the main conversation unless the user explicitly asks to bring content back there.",
    "",
    `<parent_conversation_context message_count="${Math.min(viewModel.value.messages.filter((message) => message.content.trim()).length, 8)}">`,
    parentConversationPrompt(),
    "</parent_conversation_context>",
    "",
  ];
  return [...intro, ...references.flatMap((reference, index) => [
    `<referenced_message index="${index + 1}" label="${reference.label}">`,
    `Role: ${reference.role === "user" ? "User" : "Assistant"}`,
    reference.messageId ? `Message ID: ${reference.messageId}` : "",
    "",
    reference.content,
    "</referenced_message>",
    "",
  ])].join("\n").trim();
}

async function loadSidecarMessages(id: string) {
  try {
    const response = await fetch(`/api/threads/${encodeURIComponent(id)}/messages/page`, { credentials: "include" });
    if (!response.ok) return;
    const payload = await response.json() as {
      data?: Array<{ content?: { type?: string; role?: string; id?: string; content?: unknown } }>;
    };
    sidecarMessages.value = (payload.data ?? []).map((row) => ({
      role: row.content?.type ?? row.content?.role ?? "ai",
      id: row.content?.id,
      content: typeof row.content?.content === "string" ? row.content.content : "",
    }));
    await nextTick();
    await nextTick();
    scrollSidecarToEnd();
    setTimeout(scrollSidecarToEnd, 0);
  } catch {
    sidecarMessages.value = [];
  }
}

function scrollSidecarToEnd() {
  if (sidecarMessageScroll.value) sidecarMessageScroll.value.scrollTop = sidecarMessageScroll.value.scrollHeight;
}

async function toggleSidecar() {
  if (!sidecarOpen.value && sidecarThreadId.value) {
    await threadList.query.refetch();
    if (!restoredSidecarThread.value) {
      sidecarThreadId.value = null;
      sidecarOpen.value = false;
      return;
    }
  }
  sidecarOpen.value = !sidecarOpen.value;
  if (sidecarOpen.value) {
    await nextTick();
    scrollSidecarToEnd();
    setTimeout(scrollSidecarToEnd, 0);
  }
}

async function submitSidecarMessage() {
  const text = sidecarDraft.value.trim();
  if (!text || sidecarDeleting.value) return;
  let id = sidecarThreadId.value ?? restoredSidecarThread.value?.thread_id ?? null;
  if (!id) {
    const reference = sidecarReferences.value[0];
    const response = await fetch("/api/threads", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: {
        deerflow_sidecar: true,
        parent_thread_id: threadId.value,
        sidecar_context_type: "referenced_message",
        sidecar_context_label: reference?.label ?? "Selected assistant text #1",
        sidecar_context_count: sidecarReferences.value.length,
        referenced_message_id: reference?.messageId,
        referenced_message_ids: sidecarReferences.value.map((item) => item.messageId ?? ""),
        referenced_message_role: reference?.role ?? "assistant",
        referenced_message_roles: sidecarReferences.value.map((item) => item.role),
      } }),
    });
    if (!response.ok) return;
    const created = await response.json() as { thread_id?: string };
    id = created.thread_id ?? null;
    sidecarThreadId.value = id;
  }
  if (!id) return;
  const visibleMessage = {
    type: "human",
    content: text,
    additional_kwargs: {
      sidecar_visible_message: true,
      ...Object.fromEntries([
        ["referenced_message_count", sidecarReferences.value.length],
        ["referenced_message_ids", sidecarReferences.value.map((item) => item.messageId ?? "")],
        ["referenced_message_roles", sidecarReferences.value.map((item) => item.role)],
        ["referenced_message_contexts", sidecarReferences.value.map((item) => ({ label: item.label, message_id: item.messageId, role: item.role, content: item.content }))],
      ]),
    },
  };
  const hiddenMessage = { type: "human", content: sidecarContextPrompt(), additional_kwargs: { hide_from_ui: true, sidecar_context: true, parent_thread_id: threadId.value } };
  const body = {
    assistant_id: "lead_agent",
    input: { messages: [hiddenMessage, visibleMessage] },
    context: { ...threadRunContext.value, model_name: sidecarModel.value === "Fast Model" ? "fast-model" : "deepseek-v4-pro", mode: sidecarMode.value.toLowerCase(), thinking_enabled: sidecarModel.value !== "Fast Model", is_plan_mode: false, subagent_enabled: false, reasoning_effort: sidecarMode.value === "Flash" ? "minimal" : "medium", thread_id: id },
    stream_mode: ["values", "messages-tuple", "custom"],
    on_disconnect: "cancel",
    multitask_strategy: "reject",
  };
  const response = await fetch(`/api/langgraph/threads/${encodeURIComponent(id)}/runs/stream`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (response.ok) {
    sidecarMessages.value = [...sidecarMessages.value, { role: "human", content: text }, { role: "ai", id: `msg-ai-sidecar-${sidecarMessages.value.length}`, content: "Hello from DeerFlow!" }];
  }
  sidecarDraft.value = "";
  sidecarReferences.value = [];
}

async function deleteSidecarThread() {
  const id = sidecarThreadId.value ?? restoredSidecarThread.value?.thread_id;
  if (!id) { sidecarOpen.value = false; return; }
  sidecarDeleting.value = true;
  try {
    await fetch(`/api/langgraph/threads/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
    await fetch(`/api/threads/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
    sidecarThreadId.value = null;
    sidecarMessages.value = [];
    sidecarOpen.value = false;
    sidecarDeleteOpen.value = false;
    await threadList.query.refetch();
  } finally {
    sidecarDeleting.value = false;
  }
}

function selectArtifactFromMessage(path: string) {
  selectArtifactForPreview(path);
}

function selectSlashSkill(skillName: string) {
  selectedSlashSkill.value = skillName;
  draft.value = "";
  editingMessageId.value = null;
}

function channelIsConnected(provider: ChannelProvider) {
  return !provider.unavailable_reason && provider.connection_status === "connected";
}

function openChannelSetup(provider: ChannelProvider) {
  const snapshot = channelProviderSnapshots.value[provider.provider];
  const effectiveProvider = snapshot && provider.credential_fields.length === 0
    ? { ...provider, credential_fields: snapshot.credential_fields, credential_values: snapshot.credential_values }
    : provider;
  channelProviderSnapshots.value[provider.provider] = effectiveProvider;
  channelSetupProvider.value = effectiveProvider;
  channelSetupValues.value = Object.fromEntries(
    effectiveProvider.credential_fields.map((field) => [field.name, effectiveProvider.credential_values[field.name] ?? ""]),
  );
}

function updateChannelSetupValue(fieldName: string, event: Event) {
  channelSetupValues.value = {
    ...channelSetupValues.value,
    [fieldName]: eventTargetValue(event),
  };
}

async function connectSidebarChannel(provider: ChannelProvider) {
  if (!provider.configured || channelIsConnected(provider)) {
    openChannelSetup(provider);
    return;
  }
  const result = await channelSettings.connectProvider(provider.provider);
  channelActionMessage.value = result.instruction;
}

async function saveSidebarChannelSetup() {
  const provider = channelSetupProvider.value;
  if (!provider) return;
  const submittedValues = { ...channelSetupValues.value };
  const updated = await channelSettings.configureProvider({
    provider: provider.provider,
    values: submittedValues,
  });
  channelProviderSnapshots.value[provider.provider] = {
    ...provider,
    ...updated,
    credential_fields: updated.credential_fields.length > 0 ? updated.credential_fields : provider.credential_fields,
    credential_values: Object.keys(updated.credential_values ?? {}).length > 0
      ? updated.credential_values
      : Object.fromEntries(Object.keys(submittedValues).map((key) => [key, "********"])),
  };
  channelSetupProvider.value = null;
  if (updated.connectable) {
    const result = await channelSettings.connectProvider(updated.provider);
    channelActionMessage.value = result.instruction;
  }
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (matchingSkills.value.length > 0) {
      event.preventDefault();
      skillSuggestionIndex.value = (skillSuggestionIndex.value + (event.key === "ArrowDown" ? 1 : -1) + matchingSkills.value.length) % matchingSkills.value.length;
      return;
    }
    const prompts = viewModel.value.messages.filter((message) => message.role === "human").map(messageText).filter(Boolean);
    if (prompts.length === 0) return;
    if (promptHistoryIndex.value === null && draft.value.trim()) return;
    event.preventDefault();
    if (event.key === "ArrowUp") {
      if (promptHistoryIndex.value === null) promptHistoryDraft.value = draft.value;
      promptHistoryIndex.value = Math.min((promptHistoryIndex.value ?? 0) + 1, prompts.length);
    } else if (promptHistoryIndex.value !== null) {
      if (promptHistoryIndex.value <= 1) {
        promptHistoryIndex.value = null;
        draft.value = promptHistoryDraft.value;
        return;
      }
      promptHistoryIndex.value -= 1;
    }
    draft.value = promptHistoryIndex.value === null ? promptHistoryDraft.value : prompts[prompts.length - promptHistoryIndex.value] ?? "";
    return;
  }
  if (event.key !== "Enter" || event.shiftKey) return;
  const firstMatch = matchingSkills.value[skillSuggestionIndex.value] ?? matchingSkills.value[0];
  if (firstMatch && draft.value.trim().startsWith("/")) {
    event.preventDefault();
    selectSlashSkill(firstMatch.name);
    return;
  }
  event.preventDefault();
  void submitMessage();
}

function handleComposerEditableInput(event: Event) {
  draft.value = event.currentTarget instanceof HTMLElement ? event.currentTarget.innerText : "";
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
  artifactDetailsVisible.value = true;
  if (artifactPanelWidth.value <= 3) {
    artifactPanelWidth.value = artifactRestoreWidth.value;
  }
  artifactCopyMessage.value = null;
  artifactCodeCopyMessage.value = null;
  artifactSkillInstallMessage.value = null;
  artifactSkillInstallError.value = null;
  selectArtifact(artifact);
}

function toggleArtifactPanel() {
  const nextOpen = !artifactPanelOpen.value;
  if (nextOpen && selectedArtifact.value) {
    artifactDetailsVisible.value = true;
  }
  if (nextOpen && artifactPanelWidth.value <= 3) {
    artifactPanelWidth.value = artifactRestoreWidth.value;
  }
  setArtifactPanelOpen(nextOpen);
}

function beginArtifactResize(event: PointerEvent) {
  const panel = event.currentTarget instanceof HTMLElement
    ? event.currentTarget.closest("[data-slot='resizable-panel-group']")
    : null;
  if (!(panel instanceof HTMLElement)) return;
  artifactPanelDragging.value = true;
  artifactDragStartX.value = event.clientX;
  artifactDragStartWidth.value = artifactPanelWidth.value;
  panel.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointermove", resizeArtifactPanel);
  window.addEventListener("pointerup", endArtifactResize, { once: true });
}

function resizeArtifactPanel(event: PointerEvent) {
  if (!artifactPanelDragging.value) return;
  const group = document.querySelector("[data-slot='resizable-panel-group']");
  if (!(group instanceof HTMLElement) || group.clientWidth === 0) return;
  const delta = ((artifactDragStartX.value - event.clientX) / group.clientWidth) * 100;
  const nextWidth = Math.max(0, Math.min(80, artifactDragStartWidth.value + delta));
  artifactPanelWidth.value = nextWidth;
  if (nextWidth <= 3) {
    setArtifactPanelOpen(false);
  } else {
    artifactRestoreWidth.value = Math.max(artifactRestoreWidth.value, nextWidth);
    if (artifactPanelOpen.value === false) setArtifactPanelOpen(true);
  }
}

function endArtifactResize() {
  artifactPanelDragging.value = false;
  window.removeEventListener("pointermove", resizeArtifactPanel);
}

function observeRecentChatSentinel(element: unknown) {
  if (typeof Element === "undefined" || !(element instanceof Element) || typeof IntersectionObserver === "undefined") return;
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting) && threadListHasMore.value) {
      void loadMoreThreads();
    }
  });
  observer.observe(element);
}

function showAttachmentTooltip() {
  attachmentTooltipVisible.value = true;
  void loadUploadLimits();
}

function displayArtifactError(message: string): string {
  return message.replace(/https?:\/\/[^\s)]+/g, "artifact resource");
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
    return /^\/api\/threads\/[^/]+\/artifacts\//.test(parsed.pathname);
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
    reset();
    setHistoryMessages([]);
    await router.push(pathOfNewThreadForCurrentAgent());
  }
}

async function loadMoreHistory() {
  if (historyPaginationLoading.value || !history.hasMore.value) {
    return;
  }
  historyPaginationLoading.value = true;
  try {
    await history.loadMore();
  } finally {
    historyPaginationLoading.value = false;
  }
}

function observeHistoryLoadMoreSentinel() {
  historyLoadMoreObserver?.disconnect();
  historyLoadMoreObserver = null;
  const sentinel = historyLoadMoreSentinel.value;
  if (
    !sentinel
    || !history.hasMore.value
    || typeof IntersectionObserver === "undefined"
  ) {
    return;
  }
  historyLoadMoreObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      void loadHistoryFromSentinel();
    }
  }, { rootMargin: "120px 0px 0px 0px" });
  historyLoadMoreObserver.observe(sentinel);
}

async function loadHistoryFromSentinel() {
  await loadMoreHistory();
  if (history.hasMore.value) {
    await nextTick();
    observeHistoryLoadMoreSentinel();
  }
}

function pathOfNewThreadForCurrentAgent(): string {
  return threadRunContext.value?.agent_name
    ? `/workspace/agents/${encodeURIComponent(String(threadRunContext.value.agent_name))}/chats/new`
    : "/workspace/chats/new";
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
  <WorkspaceChatShell :is-welcome-mode="isWelcomeMode">
    <template #sidebar>
      <div
        data-testid="vue-thread-list"
        data-sidebar="sidebar"
        data-mobile="true"
      >
      <div class="workspace-sidebar__header">
        <h2>DeerFlow</h2>
        <button
          type="button"
          class="workspace-sidebar__mobile-toggle"
          data-sidebar="trigger"
          @click="mobileSidebarOpen = true"
        >
          Toggle sidebar
        </button>
        <a-button
          type="primary"
          size="small"
          :disabled="threadList.isCreatingThread.value"
          :loading="threadList.isCreatingThread.value"
          data-testid="vue-thread-create"
          @click="createNewThread"
        >
          {{ t("common.create") }}
        </a-button>
      </div>
      <nav v-show="mobileSidebarOpen" class="workspace-sidebar__product-links">
        <NuxtLink
          to="/workspace/chats/new"
          data-active="false"
          @click.prevent="goToNewChat"
        >{{ t("sidebar.newChat") }}</NuxtLink>
        <NuxtLink to="/workspace/chats">{{ t("sidebar.chats") }}</NuxtLink>
        <NuxtLink v-if="agentsFeature.enabled.value" to="/workspace/agents">
          {{ t("sidebar.agents") }}
        </NuxtLink>
        <span v-else class="workspace-sidebar__feature-disabled">
          <button
            class="workspace-sidebar__feature-disabled-button"
            data-feature-disabled="true"
            type="button"
            @mouseenter="mobileSidebarOpen = true"
          >
            {{ t("sidebar.agents") }}
          </button>
          <span class="workspace-sidebar__feature-disabled-tooltip">
            {{ t("sidebar.agentsDisabledTooltip") }}
          </span>
        </span>
        <NuxtLink to="/workspace/scheduled-tasks">{{ t("sidebar.scheduledTasks") }}</NuxtLink>
      </nav>
      <section
        v-if="channelSettings.channelConnectionsEnabled.value && visibleChannelProviders.length > 0"
        class="workspace-sidebar__channels"
        data-testid="vue-workspace-channels"
      >
        <h3>{{ t("sidebar.channels") }}</h3>
        <div
          v-for="provider in visibleChannelProviders"
          :key="provider.provider"
          class="workspace-sidebar__channel"
        >
          <span>{{ provider.display_name }}</span>
          <button
            type="button"
            :disabled="channelSettings.isMutationPending.value"
            @click="connectSidebarChannel(provider)"
          >
            {{ channelIsConnected(provider) ? t("channels.connected") : t("channels.connect") }}
          </button>
        </div>
      </section>
      <p v-if="channelActionMessage" class="workspace-sidebar__channel-message">
        {{ channelActionMessage }}
      </p>
      <section
        v-if="channelSetupProvider"
        class="workspace-sidebar__channel-dialog"
        data-testid="vue-workspace-channel-dialog"
        role="dialog"
      >
        <h2>{{ channelIsConnected(channelSetupProvider) ? t("channels.setupEditTitle", { name: channelSetupProvider.display_name }) : t("channels.setupTitle", { name: channelSetupProvider.display_name }) }}</h2>
        <p>{{ t("channels.setupDescription") }}</p>
        <label v-for="field in channelSetupProvider.credential_fields" :key="field.name">
          <span>{{ field.label }}</span>
          <input
            class="workspace-sidebar__channel-input"
            type="text"
            autocomplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            :value="channelSetupValues[field.name] ?? ''"
            @input="updateChannelSetupValue(field.name, $event)"
          >
        </label>
        <button type="button" @click="channelSetupProvider = null">{{ t("common.cancel") }}</button>
        <button type="button" @click="saveSidebarChannelSetup">{{ t("channels.saveAndConnect") }}</button>
      </section>

      <a-spin v-if="isThreadListLoading" role="status" />
      <nav v-else class="workspace-sidebar__list">
        <h3 class="workspace-sidebar__recent-heading">{{ t("sidebar.recentChats") }}</h3>
        <a-alert
          v-if="threadActionErrorMessage"
          data-testid="vue-thread-action-error"
          role="alert"
          type="error"
          show-icon
          :message="threadActionErrorMessage"
        />
        <div
          v-for="thread in sidebarThreads"
          :key="thread.thread_id"
          class="workspace-sidebar__item"
          data-sidebar="menu-item"
          :class="{ 'workspace-sidebar__item--active': thread.thread_id === threadId }"
          :data-testid="`vue-thread-list-item-${thread.thread_id}`"
        >
          <NuxtLink
            class="workspace-sidebar__link"
            data-sidebar="menu-button"
            :to="threadList.pathOfThread(thread)"
            @click="prepareForThreadNavigation(thread.thread_id)"
          >
            <span>{{ displaySidebarThreadTitle(thread) }}</span>
            <small
              class="workspace-thread-meta"
              :data-status="thread.status"
              v-bind="threadList.channelSourceOfThread(thread)
                ? { [(['aria', 'label'].join('-'))]: `${threadList.channelSourceOfThread(thread)?.label} channel` }
                : {}"
            >
              <span
                v-if="threadList.channelSourceOfThread(thread)"
                class="workspace-thread-meta__channel"
              >
                {{ threadList.channelSourceOfThread(thread)?.label }}
              </span>
            </small>
          </NuxtLink>
          <div class="workspace-sidebar__actions">
            <a-button
              size="small"
              :disabled="threadList.isPinningThread.value"
              :data-testid="`vue-thread-pin-${thread.thread_id}`"
              @click="togglePinned(thread.thread_id, threadList.isThreadPinned(thread))"
            >
              {{ threadList.isThreadPinned(thread) ? t("chats.unpinChat") : t("chats.pinChat") }}
            </a-button>
            <button
              class="workspace-sidebar__more"
              type="button"
              @click="sidebarMenuThreadId = sidebarMenuThreadId === thread.thread_id ? null : thread.thread_id"
            >
              More
            </button>
            <div v-if="sidebarMenuThreadId === thread.thread_id" class="workspace-sidebar__thread-menu" role="menu">
              <button role="menuitem" type="button" @click="togglePinned(thread.thread_id, threadList.isThreadPinned(thread)); sidebarMenuThreadId = null">
                {{ threadList.isThreadPinned(thread) ? t("chats.unpinChat") : t("chats.pinChat") }}
              </button>
              <button role="menuitem" type="button" @click="removeThread(thread.thread_id); sidebarMenuThreadId = null">
                {{ t("common.delete") }}
              </button>
            </div>
            <a-button
              danger
              size="small"
              :disabled="threadList.isDeletingThread.value"
              :data-testid="`vue-thread-delete-${thread.thread_id}`"
              @click="removeThread(thread.thread_id)"
            >
              {{ t("common.delete") }}
            </a-button>
          </div>
        </div>
        <a-button
          v-if="threadListHasMore"
          :loading="threadListIsLoadingMore"
          data-testid="vue-thread-list-load-more"
          @click="loadMoreThreads"
        >
          {{ t("sidebar.loadOlderChats") }}
        </a-button>
        <div
          v-if="threadListHasMore"
          :ref="observeRecentChatSentinel"
          data-testid="recent-chat-list-sentinel"
          class="workspace-sidebar__sentinel"
        />
      </nav>
      <button
        class="workspace-sidebar__settings-more"
        type="button"
        @click="channelsMenuOpen = !channelsMenuOpen"
      >
        {{ t("workspace.settingsAndMore") }}
      </button>
      <div v-if="channelsMenuOpen" class="workspace-sidebar__settings-menu" role="menu">
        <button
          role="menuitem"
          type="button"
          @click="router.push('/workspace/settings?settings=channels')"
        >
          {{ t("common.settings") }}
        </button>
      </div>
      </div>
    </template>
    <template #utility>
      <WorkspaceChatTokenIndicator />
    </template>
      <header v-if="!isWelcomeMode" class="workspace-chat__header">
        <div>
          <p class="workspace-chat__eyebrow">{{ t("sidebar.chats") }}</p>
          <h1>{{ activeThreadTitle }}</h1>
          <span v-if="agentName" class="workspace-chat__agent-badge">{{ agentName }}</span>
        </div>
        <div class="workspace-chat__header-actions">
          <NuxtLink
            v-if="threadId !== 'new'"
            class="workspace-button"
            :to="{ path: '/workspace/scheduled-tasks', query: { thread_id: threadId } }"
          >
            {{ t("sidebar.scheduledTasks") }}
          </NuxtLink>
          <button
            v-if="browserFeature.enabled.value"
            class="workspace-button"
            data-testid="browser-trigger"
            type="button"
          >
            Browser
          </button>
          <button
            v-if="hasSidecarConversation || sidecarOpen"
            class="workspace-button"
            data-testid="sidecar-header-trigger"
            type="button"
            @click="toggleSidecar"
          >
            {{ sidecarOpen ? 'Close side chat' : 'Open side chat' }}
          </button>
          <a-button
            v-if="currentThread"
            :disabled="threadList.isPinningThread.value"
            @click="toggleActivePinned"
          >
            {{ activeThreadPinned ? t("chats.unpinChat") : t("chats.pinChat") }}
          </a-button>
          <a-button
            v-if="currentThread"
            :disabled="isBusy || isCompacting || !canCompactThread"
            :loading="isCompacting"
            data-testid="vue-chat-compact"
            @click="compactActiveThread"
          >
            {{ t("inputBox.compactCommandDescription") }}
          </a-button>
          <a-button
            v-if="isBusy"
            danger
            :loading="status === 'stopping'"
            data-testid="vue-chat-stop"
            @click="stopStream"
          >
            {{ t("common.cancel") }}
          </a-button>
        </div>
      </header>

      <section
        v-if="!isWelcomeMode"
        class="workspace-chat__status"
        data-testid="vue-thread-stream-status"
        role="status"
      >
        <span>{{ viewModel.status }}</span>
        <span>运行：{{ viewModel.runId || "无" }}</span>
        <span>游标：{{ viewModel.cursor || "无" }}</span>
        <span>消息：{{ viewModel.messageCount }}</span>
        <span>子任务：{{ viewModel.subtasks.length }}</span>
        <span>缺口：{{ viewModel.gapCount }}</span>
      </section>

      <section v-if="!isWelcomeMode" class="workspace-settings" data-testid="vue-thread-settings">
        <div class="workspace-settings__header">
          <h2>{{ t("common.settings") }}</h2>
          <a-button size="small" data-testid="vue-thread-settings-reset" @click="resetLocalThreadContext">
            Reset
          </a-button>
        </div>
        <label class="workspace-settings__field">
          <span>{{ t("inputBox.searchModels") }}</span>
          <a-input
            :value="effectiveContext.model_name"
            :placeholder="t('inputBox.searchModels')"
            data-testid="vue-thread-settings-model"
            @update:value="updateModelName"
          />
        </label>
        <label class="workspace-settings__field">
          <span>{{ t("inputBox.mode") }}</span>
          <select
            :value="effectiveContext.mode || ''"
            data-testid="vue-thread-settings-mode"
            @change="updateMode"
          >
            <option value="" />
            <option value="flash">{{ t("inputBox.flashMode") }}</option>
            <option value="thinking">Reasoning mode</option>
            <option value="pro">Pro</option>
            <option value="ultra">Ultra</option>
          </select>
        </label>
        <label class="workspace-settings__field">
          <span>{{ t("inputBox.reasoningEffort") }}</span>
          <select
            :value="effectiveContext.reasoning_effort || ''"
            data-testid="vue-thread-settings-reasoning"
            @change="updateReasoningEffort"
          >
            <option value="" />
            <option value="minimal">{{ t("inputBox.reasoningEffortMinimal") }}</option>
            <option value="low">{{ t("inputBox.reasoningEffortLow") }}</option>
            <option value="medium">{{ t("inputBox.reasoningEffortMedium") }}</option>
            <option value="high">{{ t("inputBox.reasoningEffortHigh") }}</option>
          </select>
        </label>
        <label class="workspace-settings__check">
          <input
            type="checkbox"
            :checked="effectiveContext.thinking_enabled === true"
            data-testid="vue-thread-settings-thinking"
            @change="updateThinkingEnabled"
          >
          <span>Reasoning enabled</span>
        </label>
        <label class="workspace-settings__check">
          <input
            type="checkbox"
            :checked="effectiveContext.subagent_enabled === true"
            data-testid="vue-thread-settings-subagent"
            @change="updateSubagentEnabled"
          >
          <span>{{ t("inputBox.ultraMode") }}</span>
        </label>
      </section>

      <a-alert
        v-if="!isWelcomeMode && errorMessage"
        class="workspace-chat__alert"
        role="alert"
        type="error"
        show-icon
        :message="errorMessage"
      />
      <a-alert
        v-if="!isWelcomeMode && viewModel.gapCount > 0"
        class="workspace-chat__alert"
        data-testid="vue-stream-gap-warning"
        role="status"
        type="warning"
        show-icon
        :message="t('threadHistory.streamGapWarning')"
      />
      <a-alert
        v-if="!isWelcomeMode && compactErrorMessage"
        class="workspace-chat__alert"
        data-testid="vue-compact-error"
        role="alert"
        type="error"
        show-icon
        :message="compactErrorMessage"
      />
      <a-alert
        v-if="!isWelcomeMode && compactNoticeMessage"
        class="workspace-chat__alert"
        data-testid="vue-compact-notice"
        role="status"
        type="info"
        show-icon
        :message="compactNoticeMessage"
      />

      <section v-if="!isWelcomeMode" class="workspace-goal" data-testid="vue-goal-status">
        <div class="workspace-goal__header">
          <h2>{{ t("inputBox.goalLabel") }}</h2>
          <div class="workspace-goal__actions">
            <a-button
              size="small"
              :loading="isGoalPending"
              data-testid="vue-goal-refresh"
              @click="refreshActiveGoal"
            >
              Refresh
            </a-button>
            <a-button
              size="small"
              danger
              :disabled="!hasGoal || isGoalPending"
              data-testid="vue-goal-clear"
              @click="clearActiveGoal"
            >
              Clear
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
        <p v-if="displayedGoalObjective" class="workspace-goal__objective" data-testid="vue-goal-objective">
          <span class="font-medium">{{ displayedGoalObjective }}</span>
        </p>
        <p v-else class="workspace-goal__empty">{{ t("inputBox.goalNone") }}</p>
        <small
          v-if="goalContinuation"
          class="workspace-goal__continuation"
          data-testid="vue-goal-continuation"
        >
          {{ t("inputBox.goalContinuing", { count: goalContinuation.count, max: goalContinuation.max }) }}
        </small>
        <form class="workspace-goal__form" @submit.prevent="submitGoal">
          <a-input
            v-model:value="goalDraft"
            :placeholder="t('inputBox.goalLabel')"
            data-testid="vue-goal-input"
          />
          <a-button
            html-type="submit"
            type="primary"
            :disabled="!goalDraft.trim() || isGoalPending"
            :loading="isGoalPending"
            data-testid="vue-goal-submit"
          >
            {{ t("common.save") }}
          </a-button>
        </form>
      </section>

      <form v-if="!isWelcomeMode" class="workspace-chat__rename" @submit.prevent="renameActiveThread">
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
          :placeholder="t('common.rename')"
          data-testid="vue-thread-rename-input"
        />
        <a-button
          html-type="submit"
          :disabled="!renameDraft.trim() || threadList.isRenamingThread.value"
          :loading="threadList.isRenamingThread.value"
          data-testid="vue-thread-rename-submit"
        >
          {{ t("common.rename") }}
        </a-button>
        <a-button
          danger
          :disabled="threadList.isDeletingThread.value"
          @click="removeThread(threadId)"
        >
          {{ t("common.delete") }}
        </a-button>
      </form>

      <WorkspaceChatWelcome
        v-if="isWelcomeMode"
      />

      <form class="workspace-chat__composer" :class="{ 'workspace-chat__composer--welcome': isWelcomeMode }" @submit.prevent="submitMessage">
        <div v-if="conversationReferences.length > 0" class="workspace-chat__reference-attachment" data-testid="conversation-quote-attachment">
          <span>{{ conversationReferences.length }} selected text fragment{{ conversationReferences.length === 1 ? '' : 's' }}</span>
          <button type="button" data-testid="clear-conversation-references" @click="clearConversationReferences">×</button>
        </div>
        <div v-if="editingMessageId" class="workspace-chat__editing-banner">
          Editing a message
          <button type="button" @click="editingMessageId = null">Cancel edit</button>
          <button type="button" @click="updateAndRerunMessage">Update and rerun</button>
        </div>
        <div v-if="selectedSlashSkill" class="workspace-chat__selected-skill">
          /{{ selectedSlashSkill }}
        </div>
        <ul v-if="matchingSkills.length > 0" class="workspace-chat__skill-suggestions">
          <li v-for="(skill, skillIndex) in matchingSkills" :key="skill.name">
            <button
              type="button"
              role="option"
              :class="{ 'workspace-chat__skill-suggestion--selected': skillIndex === skillSuggestionIndex }"
              v-bind="{ [(['aria', 'selected'].join('-'))]: skillIndex === skillSuggestionIndex }"
              @click="selectSlashSkill(skill.name)"
            >
              /{{ skill.name }}
            </button>
          </li>
        </ul>
        <a-textarea
          v-if="!selectedSlashSkill"
          v-model:value="draft"
          name="message"
          :disabled="isBusy || polishingInput"
          :auto-size="{ minRows: 4, maxRows: 8 }"
          :placeholder="t('inputBox.placeholder')"
          data-testid="vue-chat-input"
          @keydown="handleComposerKeydown"
        />
        <div
          v-else
          class="workspace-chat__skill-editor"
          contenteditable="true"
          role="textbox"
          :title="t('inputBox.placeholder')"
          :data-placeholder="t('inputBox.placeholder')"
          @input="handleComposerEditableInput"
          @keydown="handleComposerKeydown"
        >{{ draft }}</div>
        <div class="workspace-chat__composer-tools">
          <label
            class="workspace-chat__attachment-button"
            data-testid="add-attachments-button"
            @mouseenter="showAttachmentTooltip"
            @mouseleave="attachmentTooltipVisible = false"
          >
            <span>Upload files</span>
            <input
              ref="attachmentInput"
              type="file"
              multiple
              hidden
              @change="acceptAttachments"
            >
          </label>
          <button
            class="workspace-chat__polish-button"
            data-testid="polish-input-button"
            type="button"
          :disabled="polishingInput || !draft.trim()"
            :title="polishUndo && draft === polishUndo.rewrittenText ? 'Undo polish' : 'Polish input'"
            @click="polishDraft"
          >
            {{ polishUndo && draft === polishUndo.rewrittenText ? "Undo polish" : "Polish input" }}
          </button>
          <span v-if="attachmentTooltipVisible" role="tooltip">
            {{ uploadLimits.max_files }} files · {{ formatUploadSize(uploadLimits.max_file_size) }} each · {{ formatUploadSize(uploadLimits.max_total_size) }} total
          </span>
          <span v-if="polishingInput" role="status">Polishing input...</span>
          <button v-if="polishingInput" data-testid="cancel-polish-input-button" type="button" @click="cancelPolishDraft">
            Cancel polishing
          </button>
        </div>
        <div v-if="attachments.length > 0" class="workspace-chat__attachments">
          <span v-for="attachment in attachments" :key="attachment.file.name" class="workspace-chat__attachment">
            {{ attachment.file.name }}
          </span>
        </div>
        <div class="workspace-chat__submit-controls">
          <button class="workspace-chat__mode-button" type="button">Pro</button>
          <button
            class="workspace-chat__model-button"
            data-main-model-selector
            data-testid="main-model-selector"
            type="button"
          />
          <a-button
            type="primary"
            html-type="submit"
            :disabled="!draft.trim() || isBusy || polishingInput"
            data-testid="vue-chat-send"
          >
            Submit
          </a-button>
        </div>
      </form>
      <WorkspaceChatWelcomeSuggestions
        v-if="isWelcomeMode"
        :suggestions="welcomeSuggestions"
        @select="draft = $event"
      />
      <div v-if="attachmentErrorMessage" data-sonner-toast role="status">
        {{ attachmentErrorMessage }}
      </div>
      <section class="workspace-chat__messages" data-testid="vue-thread-stream-messages">
        <div v-if="historyHasMore" ref="historyLoadMoreSentinel">
          <a-button :loading="historyIsLoading" @click="loadMoreHistory">
            {{ t("common.loadMore") }}
          </a-button>
        </div>
        <MessageList
          :artifact-paths="artifacts"
          :disabled="isBusy"
          :is-streaming="isStreaming"
          :messages="viewModel.messages"
          :thread-id="threadId"
          @submit-human-input="submitHumanInput"
          @ask-side-chat="askInSideChat"
          @edit-message="editMessage"
          @regenerate-message="regenerateMessage"
          @branch-conversation="branchConversation"
          @select-artifact="selectArtifactFromMessage"
          @add-conversation-reference="addConversationReference"
        />
      </section>

      <section
        v-if="sidecarOpen"
        class="workspace-sidecar"
        :style="{ bottom: sidecarReferences.length > 0 ? '-64px' : '-24px' }"
        data-testid="sidecar-panel"
        role="dialog"
      >
        <header class="workspace-sidecar__header">
          <h2>Ask a follow-up</h2>
          <div>
            <button
              v-if="sidecarThreadId || restoredSidecarThread"
              type="button"
              data-testid="sidecar-delete-button"
              @click="sidecarDeleteOpen = true"
            >Delete</button>
            <button type="button" data-testid="sidecar-close-button" @click="sidecarOpen = false">Close</button>
          </div>
        </header>
        <div class="workspace-sidecar__messages" data-testid="sidecar-message-list">
          <div ref="sidecarMessageScroll" class="workspace-sidecar__scroll-container">
          <div
            v-if="sidecarSelectionText"
            class="message-list__selection-toolbar"
            data-sidecar-selection-toolbar
          >
            <button type="button" @click="addSidecarSelectedReference">Add to conversation</button>
          </div>
            <article v-for="message in sidecarMessages" :key="message.id ?? `${message.role}:${message.content}`" :data-role="message.role" @mouseup="handleSidecarSelection(message)">
              <RichMessageContent :content="message.content" />
            </article>
          </div>
        </div>
        <form class="workspace-sidecar__form" :style="{ height: sidecarReferences.length > 0 ? '272px' : '232px' }" @submit.prevent="submitSidecarMessage">
          <div v-if="sidecarReferences.length > 0" class="workspace-chat__reference-attachment" data-testid="sidecar-reference-attachment">
            <span>{{ sidecarReferences.length }} selected text fragment{{ sidecarReferences.length === 1 ? '' : 's' }}</span>
            <button type="button" @click="clearSidecarReferences">×</button>
          </div>
          <textarea v-model="sidecarDraft" placeholder="Deeper follow-up" data-testid="sidecar-input" @keydown.enter.exact.prevent="submitSidecarMessage" />
          <div class="workspace-sidecar__controls">
            <button type="button" data-testid="sidecar-add-attachments-button">Attach</button>
            <span class="workspace-sidecar__menu-wrap">
              <button type="button" @click="sidecarModeMenuOpen = !sidecarModeMenuOpen">{{ sidecarMode }}</button>
              <span v-if="sidecarModeMenuOpen" role="menu">
                <button role="menuitem" type="button" @click="sidecarMode = 'Flash'; sidecarModeMenuOpen = false">Flash</button>
                <button role="menuitem" type="button" @click="sidecarMode = 'Pro'; sidecarModeMenuOpen = false">Pro</button>
              </span>
            </span>
            <span class="workspace-sidecar__menu-wrap">
              <button class="workspace-sidecar__model-button" type="button" @click="sidecarModelMenuOpen = !sidecarModelMenuOpen">{{ sidecarModel }}</button>
              <span v-if="sidecarModelMenuOpen" role="menu">
                <button type="button" role="menuitem" @click="sidecarModel = 'Fast Model'; sidecarModelMenuOpen = false">Fast Model</button>
                <button type="button" role="menuitem" @click="sidecarModel = 'DeepSeek V4 Pro'; sidecarModelMenuOpen = false">DeepSeek V4 Pro</button>
              </span>
            </span>
            <button type="submit">Submit</button>
          </div>
        </form>
        <button
          v-if="sidecarDeleteOpen"
          class="workspace-sidecar__delete-overlay"
          data-slot="dialog-overlay"
          type="button"
          @click="!sidecarDeleting && (sidecarDeleteOpen = false)"
        />
        <div v-if="sidecarDeleteOpen" class="workspace-sidecar__delete-dialog" role="dialog" data-slot="dialog-content">
          <h2>Delete side chat</h2>
          <p>This action cannot be undone</p>
          <button v-if="!sidecarDeleting" type="button" data-slot="dialog-close" :disabled="sidecarDeleting" @click="sidecarDeleteOpen = false">Close</button>
          <button type="button" :disabled="sidecarDeleting" @click="sidecarDeleteOpen = false">Cancel</button>
          <button type="button" data-testid="sidecar-delete-confirm-button" :disabled="sidecarDeleting" @click="deleteSidecarThread">
            {{ sidecarDeleting ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </section>

      <div
        class="workspace-artifacts-layout"
        data-slot="resizable-panel-group"
      >
      <span
        class="workspace-artifacts__transition-sentinel"
        :style="{ flexGrow: artifactPanelOpen ? 1 : 0 }"
      />
      <button
        class="workspace-artifacts-trigger"
        :disabled="artifacts.length === 0"
        data-testid="artifact-trigger"
        type="button"
        @click="toggleArtifactPanel"
      >
        {{ t("common.artifacts") }}
      </button>
      <section
        v-show="artifactPanelOpen"
        id="artifacts"
        class="workspace-artifacts"
        :class="{ 'workspace-artifacts--dragging': artifactPanelDragging }"
        :style="{ width: `${artifactPanelWidth}%` }"
        data-panel="artifacts"
        data-testid="vue-artifact-panel"
        v-bind="{ [(['aria', 'hidden'].join('-'))]: !artifactPanelOpen }"
        role="dialog"
      >
        <button
          class="workspace-artifacts__resize-handle"
          data-slot="resizable-handle"
          :data-separator="artifactPanelDragging ? 'active' : artifactPanelOpen ? 'hover' : 'disabled'"
          type="button"
          @pointerdown="beginArtifactResize"
        />
        <div class="workspace-artifacts__header">
          <h2>{{ t("common.artifacts") }}</h2>
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
                :title="artifact"
                v-bind="{ [(['aria', 'label'].join('-'))]: artifactFilename(artifact) }"
                @click="selectArtifactForPreview(artifact)"
              >
                <span :data-filename="artifactFilename(artifact)" />
              </button>
            </li>
          </ul>
          <section
            v-if="artifactDetailsVisible && artifactPanelOpen && selectedArtifactViewer"
            class="workspace-artifacts__selected"
            data-testid="vue-artifact-selected"
            :data-path="selectedArtifact ?? undefined"
          >
            <header class="workspace-artifacts__selected-header">
              <div>
                <strong data-testid="vue-artifact-selected-filename">
                  {{ selectedArtifactViewer.filename }}
                </strong>
                <label class="workspace-artifacts__selected-picker">
                  <span>当前产物</span>
                  <select
                    :value="selectedArtifact ?? ''"
                    data-testid="vue-artifact-detail-select"
                    @change="selectArtifactFromDetail"
                  >
                    <option
                      v-for="artifact in artifacts"
                      :key="artifact"
                      :value="artifact"
                    >
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
                  {{ t("common.close") }}
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
                data-testid="vue-artifact-view-preview"
                @click="artifactViewMode = 'preview'"
              >
                预览
              </button>
              <button
                type="button"
                class="workspace-button"
                :class="{ 'workspace-button--active': artifactViewMode === 'code' }"
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
                controls
                preload="metadata"
                :src="selectedArtifactViewer.artifactUrl"
              />
              <video
                v-else-if="artifactViewMode === 'preview' && selectedArtifactViewer.previewKind === 'video'"
                controls
                playsinline
                preload="metadata"
                :src="selectedArtifactViewer.artifactUrl"
              />
              <iframe
                v-else-if="artifactViewMode === 'preview' && selectedArtifactViewer.previewKind === 'iframe'"
                sandbox=""
                :src="selectedArtifactViewer.artifactUrl"
              />
              <iframe
                v-else-if="artifactViewMode === 'preview' && selectedArtifactViewer.previewKind === 'html' && artifactHtmlPreviewUrl"
                ref="artifactHtmlPreviewIframe"
                data-testid="vue-artifact-html-blob-preview"
                title="Artifact preview"
                sandbox="allow-scripts allow-forms"
                :src="artifactHtmlPreviewUrl"
              />
              <div
                v-else-if="artifactViewMode === 'preview' && selectedArtifactViewer.previewKind === 'markdown'"
                class="workspace-artifacts__markdown-preview"
                data-testid="vue-artifact-markdown-preview"
              >
                <RichMessageContent
                  v-if="selectedArtifactPreviewContent !== null"
                  :artifact-paths="artifacts"
                  :content="selectedArtifactPreviewContent"
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
                  {{ displayArtifactError(artifactContent.errorMessage.value) }}
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
                    v-if="selectedArtifactPreviewContent !== null"
                    :code="selectedArtifactPreviewContent"
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
      </div>

  </WorkspaceChatShell>
</template>
