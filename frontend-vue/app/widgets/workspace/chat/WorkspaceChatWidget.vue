<script setup lang="ts">
import { shouldResetChatStateForThreadChange } from "../../../core/api/thread/utils";
import { installSkill } from "../../../core/api/skills/client";
import {
  artifactCodeInfo,
  artifactCodeLanguage,
  artifactFilename,
  describeArtifactViewer,
} from "../../../core/artifacts/utils";
import { readWorkspacePreferences } from "../../../core/settings/preferences";
import { extractToolRichCards } from "../../../core/messages/tool-cards";
import { useComposerActions } from "../../../features/chat/send-message/use-composer-actions";
import { useChatGoal } from "../../../features/chat/goal/use-chat-goal";
import { useChatHistoryPagination } from "../../../features/chat/history/use-chat-history-pagination";
import { useChatSidebarPagination } from "../../../features/chat/sidebar/use-chat-sidebar-pagination";
import { useChatSidebarChannels } from "../../../features/chat/sidebar/use-chat-sidebar-channels";
import { useWorkspaceNavigation } from "../../../features/workspace/navigation/use-workspace-navigation";
import { useChatThreadSettings } from "../../../features/chat/thread-settings/use-chat-thread-settings";
import { useBrowserPanel } from "../../../features/chat/browser/use-browser-panel";
import { useThreadActions } from "../../../features/chat/thread-actions/use-thread-actions";
import { useSkillSettings } from "../../../features/settings/skills/use-skill-settings";
import {
  useAgentsApiEnabled,
  useBrowserControlEnabled,
} from "../../../features/agents/use-agents-api-enabled";
import type { SidecarParentMessage, SidecarReference } from "../../../features/chat/sidecar/model";
import { useSidecarSession } from "../../../features/chat/sidecar/use-sidecar-session";
import { useArtifactHtmlPreview } from "../../../features/artifacts/preview-artifact/use-artifact-html-preview";
import ArtifactPanel from "../artifacts/ArtifactPanel.vue";
import ChatHeader from "./ChatHeader.vue";
import ChatComposer from "./ChatComposer.vue";
import ChatSidebar from "./ChatSidebar.vue";
import ChatMessagePane from "../messages/ChatMessagePane.vue";
import SidecarPanel from "../sidecar/SidecarPanel.vue";
import ChatGoalPanel from "./ChatGoalPanel.vue";
import WorkspaceChatShell from "./WorkspaceChatShell.vue";
import WorkspaceChatWelcome from "./WorkspaceChatWelcome.vue";
import WorkspacePanelLayout from "../panel-layout/WorkspacePanelLayout.vue";
import BrowserViewPanel from "../browser-view/BrowserViewPanel.vue";

const props = defineProps<{
  agentName: string | null;
  threadId: string;
}>();

const route = useRoute();
const router = useRouter();
const { locale, t } = useAppI18n();
const draft = ref("");
const selectedSlashSkill = ref<string | null>(null);
const conversationReferences = ref<SidecarReference[]>([]);
const lastNotifiedRunId = ref<string | null>(null);
const historySyncBlocked = ref(false);
const threadId = computed(() => props.threadId);
const isStaticMockDemo = computed(() => route.query.mock === "true" && threadId.value === "7cfa5f8f-a2f8-47ad-acbd-da7137baf990");
const agentsFeature = useAgentsApiEnabled({ enabled: threadId.value === "new" });
const browserFeature = useBrowserControlEnabled();
const sidebarChannels = useChatSidebarChannels();
const workspaceNavigation = useWorkspaceNavigation();
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
const {
  historyHasMore,
  historyIsLoading,
  loadMoreHistory,
  setHistoryLoadMoreSentinel,
} = useChatHistoryPagination({ history });
const threadList = useThreadList();
const sidebarPagination = useChatSidebarPagination({ threadList });
const threads = threadList.threads;
const sidebarThreads = computed(() =>
  threads.value.filter((thread) => thread.thread_id !== "new" && thread.metadata?.deerflow_sidecar !== true),
);
const restoredSidecarThread = computed(() => {
  const thread = threads.value.find(
    (candidate) => candidate.metadata?.deerflow_sidecar === true
      && candidate.metadata.parent_thread_id === threadId.value,
  );
  return thread ? { thread_id: thread.thread_id } : undefined;
});
const currentThread = computed(() =>
  threads.value.find((thread) => thread.thread_id === threadId.value),
);
const { browserOpen, latestBrowserFrame } = useBrowserPanel(computed(() => viewModel.value.messages));
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
} = useArtifactPanel(artifactPathname, artifactCandidates, {
  autoOpen: isBusy,
});
const artifactDetailsVisible = ref(artifactPanelOpen.value);
watch(artifactPanelOpen, (isOpen) => {
  if (!isOpen) {
    artifactDetailsVisible.value = false;
  } else if (selectedArtifact.value) {
    artifactDetailsVisible.value = true;
  }
});

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
const {
  errorMessage: artifactHtmlPreviewErrorMessage,
  previewUrl: artifactHtmlPreviewUrl,
  setIframeElement: setArtifactHtmlPreviewIframe,
} = useArtifactHtmlPreview({
  content: () => artifactContent.content.value,
  errorMessage: () => artifactContent.errorMessage.value,
  filepath: selectedArtifact,
  isLoading: () => artifactContent.isLoading.value,
  previewKind: () => selectedArtifactViewer.value?.previewKind,
  sourceUrl: () => artifactContent.url.value ?? selectedArtifactViewer.value?.artifactUrl,
  viewMode: artifactViewMode,
});
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
  clearGoal: clearGoalPanel,
  displayedGoalObjective,
  goalContinuation,
  goalDraft,
  goalErrorMessage,
  hasGoal,
  isGoalPending,
  onGoalCommand,
  refreshGoal: refreshGoalPanel,
  resetCommand: resetGoalCommand,
  saveGoal: saveGoalForComposer,
  submitGoal: submitGoalPanel,
} = useChatGoal({
  refetchThreads: () => threadList.query.refetch(),
  serverGoal,
  threadId,
});
const isThreadListLoading = computed(() => threadList.query.isLoading.value);
const agentName = computed(() => props.agentName);
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
  composerActions.skillSuggestionIndex.value = 0;
});
const composerDraft = useComposerDraft({
  agentName,
  skillName: selectedSlashSkill,
  text: draft,
  threadId,
});
const serverThreadContext = computed(() => currentThread.value?.context ?? null);
const threadSettings = useChatThreadSettings({
  agentName,
  serverContext: serverThreadContext,
  threadId,
});
const { threadRunContext } = threadSettings;
const parentConversationMessages = computed<SidecarParentMessage[]>(() =>
  viewModel.value.messages.map((message) => ({
    content: message.content,
    ...(message.id ? { id: message.id } : {}),
    role: message.role,
  })),
);
const sidecarSession = useSidecarSession({
  parentMessages: parentConversationMessages,
  refreshThreads: () => threadList.query.refetch(),
  restoredSidecarThread,
  threadId,
  threadRunContext,
});
const {
  addSelectedReference: addSidecarSelectedReference,
  askInSideChat,
  clearReferences: clearSidecarReferences,
  deleteSidecarThread,
  handleSidecarSelection,
  hasSidecarConversation,
  sidecarDeleteOpen,
  sidecarDeleting,
  sidecarDraft,
  sidecarMessages,
  sidecarMode,
  sidecarModeMenuOpen,
  sidecarModel,
  sidecarModelMenuOpen,
  sidecarOpen,
  sidecarReferences,
  sidecarSelectionMessageId,
  sidecarSelectionText,
  sidecarThreadId,
  submitSidecarMessage,
  toggleSidecar,
} = sidecarSession;
const compactAgentName = computed(
  () => readOptionalString(threadRunContext.value?.agent_name) ?? null,
);
const activeThreadPinned = computed(() =>
  currentThread.value ? threadList.isThreadPinned(currentThread.value) : false,
);
const threadActions = useThreadActions({
  activeThreadPinned,
  agentName,
  createThread: threadList.createThread,
  deleteThread: threadList.deleteThread,
  draft,
  isBusy,
  pathOfNewThread: pathOfNewThreadForCurrentAgent,
  pathOfThread: threadList.pathOfThread,
  onBrowserClose: () => {
    browserOpen.value = false;
  },
  onNewChatStateReset: () => {
    resetGoalCommand();
  },
  pinThread: threadList.pinThread,
  refetchHistory: () => history.query.refetch(),
  refetchThreads: () => threadList.query.refetch(),
  renameThread: threadList.renameThread,
  replaceRoute: async (path) => { await router.push(path); },
  resetSidecar: sidecarSession.resetForParentThreadChange,
  resetStream: reset,
  sendMessage,
  setHistoryMessages,
  stop,
  threadId,
  threadRunContext,
});
const {
  branchConversation,
  cancelEdit,
  createNewThread,
  editingMessageId,
  editMessage,
  goToNewChat,
  prepareForThreadNavigation,
  regenerateMessage,
  removeThread,
  stopStream,
  submitHumanInput,
  toggleActivePinned,
  togglePinned,
  updateAndRerunMessage,
} = threadActions;
const historyPrompts = computed(() => viewModel.value.messages
  .filter((message) => message.role === "human")
  .map(messageText)
  .filter(Boolean));
const composerActions = useComposerActions({
  agentName: compactAgentName,
  createThread: threadList.createThread,
  draft,
  editingMessageId,
  historyPrompts,
  isBusy,
  matchingSkills,
  onGoalCommand,
  refetchHistory: () => history.query.refetch(),
  refetchThreads: () => threadList.query.refetch(),
  clearDraft: composerDraft.clear,
  replaceThreadRoute: async (activeThreadId) => {
    await router.replace(`/workspace/chats/${encodeURIComponent(activeThreadId)}`);
  },
  saveGoal: saveGoalForComposer,
  selectedSlashSkill,
  sendMessage,
  threadId,
  threadRunContext,
});
const {
  acceptAttachments,
  attachmentErrorMessage,
  attachmentTooltipVisible,
  attachments,
  cancelPolishDraft,
  formatUploadSize,
  handleComposerEditableInput,
  handleComposerKeydown,
  polishingInput,
  polishDraft,
  polishUndo,
  selectSlashSkill,
  showAttachmentTooltip,
  skillSuggestionIndex,
  submitMessage,
  uploadLimits,
} = composerActions;
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
  sidecarSession.resetForParentThreadChange();
  browserOpen.value = false;
  reset();
  setHistoryMessages([]);
});

watch(
  () => route.fullPath,
  async (nextPath, previousPath) => {
    if (nextPath === previousPath) return;
    historySyncBlocked.value = true;
    reset();
    setHistoryMessages([]);
    draft.value = "";
    sidecarSession.resetForParentThreadChange();
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

watch(
  () => selectedArtifact.value,
  () => {
    artifactViewMode.value = selectedArtifactCanShowBrowserPreview.value ? "preview" : "code";
    artifactCodeCopyMessage.value = null;
  },
  { immediate: true },
);

onMounted(() => {
  const settings = route.query.settings;
  if (typeof settings === "string" && settings.length > 0) {
    void router.replace({
      path: "/workspace/settings",
      query: { settings },
    });
  }
  if (isStaticMockDemo.value) {
    setHistoryMessages([
      { type: "human", id: "static-demo-human", content: [{ type: "text", text: "What might be the trends and opportunities in 2026?" }] },
      { type: "ai", id: "static-demo-ai", content: "I've created a modern, minimalist website showcasing the 2026 trends and opportunities analysis." },
    ]);
  }
});

const activeThreadTitle = computed(() => {
  if (!currentThread.value) return threadId.value === "new" ? "New Chat" : threadId.value;
  return displaySidebarThreadTitle(currentThread.value);
});

const headerTokenUsage = computed(() => {
  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  const readNumber = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  let inputTokens = 0;
  let outputTokens = 0;
  let found = false;
  for (const message of viewModel.value.messages) {
    const raw = asRecord(message.raw);
    const usageCandidates = [
      asRecord(raw?.usage_metadata),
      asRecord(asRecord(raw?.response_metadata)?.token_usage),
      asRecord(asRecord(raw?.additional_kwargs)?.usage),
    ];
    for (const usage of usageCandidates) {
      if (!usage) continue;
      const input = readNumber(usage.input_tokens ?? usage.prompt_tokens);
      const output = readNumber(usage.output_tokens ?? usage.completion_tokens);
      if (input !== null || output !== null) found = true;
      inputTokens += input ?? 0;
      outputTokens += output ?? 0;
    }
  }
  return {
    inputTokens: found ? inputTokens : null,
    outputTokens: found ? outputTokens : null,
    totalTokens: found ? inputTokens + outputTokens : null,
  };
});

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

function exportThread(format: "markdown" | "json"): void {
  const messages = viewModel.value.messages;
  const content = format === "json"
    ? JSON.stringify(messages, null, 2)
    : messages
      .map((message) => `### ${message.role === "human" ? "User" : "Assistant"}\n\n${message.content}`)
      .join("\n\n");
  const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${activeThreadTitle.value || "deerflow-chat"}.${format === "json" ? "json" : "md"}`;
  anchor.click();
  URL.revokeObjectURL(url);
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

function clearConversationReferences() {
  conversationReferences.value = [];
}

function selectArtifactFromMessage(path: string) {
  selectArtifactForPreview(path);
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
  setArtifactPanelOpen(nextOpen);
}

function toggleBrowserPanel(): void {
  if (browserOpen.value && !sidecarOpen.value) {
    browserOpen.value = false;
    return;
  }
  sidecarOpen.value = false;
  browserOpen.value = true;
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

function pathOfNewThreadForCurrentAgent(): string {
  return threadRunContext.value?.agent_name
    ? `/workspace/agents/${encodeURIComponent(String(threadRunContext.value.agent_name))}/chats/new`
    : "/workspace/chats/new";
}

function eventTargetValue(event: Event): string {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement
    ? target.value.trim()
    : "";
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function isSkillArchiveArtifact(filepath: string): boolean {
  const filename = artifactFilename(filepath).toLocaleLowerCase();
  return filename.endsWith(".zip") || filename.endsWith(".skill");
}

</script>

<template>
  <WorkspaceChatShell
    :is-welcome-mode="isWelcomeMode"
    :mobile-nav-open="workspaceNavigation.isMobileOpen.value"
    @toggle-mobile-nav="workspaceNavigation.toggleMobileOpen"
  >
    <template #sidebar>
      <ChatSidebar
        :agents-enabled="agentsFeature.enabled.value"
        :channels="sidebarChannels"
        :is-thread-list-loading="isThreadListLoading"
        :pagination="sidebarPagination"
        :thread-action-error-message="threadActionErrorMessage"
        :thread-id="threadId"
        :thread-list="threadList"
        :threads="sidebarThreads"
        :navigation="workspaceNavigation"
        @create-thread="createNewThread"
        @delete-thread="removeThread"
        @go-to-new-chat="goToNewChat"
        @prepare-thread-navigation="prepareForThreadNavigation"
        @toggle-pinned="togglePinned"
        @toggle-settings-menu="router.push('/workspace/settings?settings=channels')"
      />
    </template>
      <ChatHeader
        :active-thread-pinned="activeThreadPinned"
        :active-thread-title="activeThreadTitle"
        :agent-name="agentName"
        :browser-enabled="browserFeature.enabled.value"
        :browser-open="browserOpen"
        :can-compact-thread="canCompactThread"
        :current-thread="Boolean(currentThread)"
        :has-sidecar-conversation="hasSidecarConversation"
        :is-busy="isBusy"
        :is-compacting="isCompacting"
        :is-welcome-mode="isWelcomeMode"
        :input-tokens="headerTokenUsage.inputTokens"
        :output-tokens="headerTokenUsage.outputTokens"
        :pinning-thread="threadList.isPinningThread.value"
        :sidecar-open="sidecarOpen"
        :status="status"
        :thread-id="threadId"
        :total-tokens="headerTokenUsage.totalTokens"
        @toggle-sidecar="toggleSidecar"
        @toggle-browser="toggleBrowserPanel"
        @toggle-active-pinned="toggleActivePinned"
        @compact="compactActiveThread"
        @export="exportThread"
        @stop-run="stopStream"
      />

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

      <div
        v-if="!isWelcomeMode"
        class="workspace-chat__goal-layer"
        :class="{ 'workspace-chat__goal-layer--empty': !hasGoal && !goalContinuation }"
      >
        <ChatGoalPanel
          :displayed-goal-objective="displayedGoalObjective"
          :goal-continuation="goalContinuation"
          :goal-draft="goalDraft"
          :goal-error-message="goalErrorMessage"
          :has-goal="hasGoal"
          :is-goal-pending="isGoalPending"
          @refresh="refreshGoalPanel"
          @clear="clearGoalPanel"
          @submit="submitGoalPanel"
          @update:goal-draft="goalDraft = $event"
        />
      </div>

      <WorkspaceChatWelcome
        v-if="isWelcomeMode"
      />

      <ChatComposer
        :attachment-error-message="attachmentErrorMessage"
        :attachment-tooltip-visible="attachmentTooltipVisible"
        :attachments="attachments"
        :conversation-references="conversationReferences"
        :draft="draft"
        :editing-message-id="editingMessageId"
        :format-upload-size="formatUploadSize"
        :is-busy="isBusy"
        :is-welcome-mode="isWelcomeMode"
        :matching-skills="matchingSkills"
        :polishing-input="polishingInput"
        :polish-undo="polishUndo"
        :selected-slash-skill="selectedSlashSkill"
        :skill-suggestion-index="skillSuggestionIndex"
        :upload-limits="uploadLimits"
        :welcome-suggestions="welcomeSuggestions"
        :thread-settings="threadSettings"
        @add-attachment="acceptAttachments"
        @attachment-tooltip-visible="showAttachmentTooltip"
        @cancel-edit="cancelEdit"
        @cancel-polish="cancelPolishDraft"
        @clear-attachment-tooltip="attachmentTooltipVisible = false"
        @clear-references="clearConversationReferences"
        @editable-input="handleComposerEditableInput"
        @keydown="handleComposerKeydown"
        @polish="polishDraft"
        @select-skill="selectSlashSkill"
        @select-suggestion="draft = $event"
        @submit="submitMessage"
        @update-and-rerun="updateAndRerunMessage"
        @update:draft="draft = $event"
      />
      <ChatMessagePane
        :artifact-paths="artifacts"
        :disabled="isBusy"
        :history-has-more="historyHasMore"
        :history-is-loading="historyIsLoading"
        :is-streaming="isStreaming"
        :messages="viewModel.messages"
        :on-history-sentinel="setHistoryLoadMoreSentinel"
        :thread-id="threadId"
        @load-more-history="loadMoreHistory"
        @submit-human-input="submitHumanInput"
        @ask-side-chat="askInSideChat"
        @edit-message="editMessage"
        @regenerate-message="regenerateMessage"
        @branch-conversation="branchConversation"
        @select-artifact="selectArtifactFromMessage"
        @add-conversation-reference="addConversationReference"
      />

      <WorkspacePanelLayout
        :artifact-open="artifactPanelOpen"
        :browser-open="browserOpen"
        :sidecar-open="sidecarOpen"
        :storage-key="`deerflow.workspace-panels.${threadId}`"
        @update-artifact-open="setArtifactPanelOpen"
      >
      <SidecarPanel
        v-if="sidecarOpen"
        :deleting="sidecarDeleting"
        :delete-open="sidecarDeleteOpen"
        :draft="sidecarDraft"
        :messages="sidecarMessages"
        :mode="sidecarMode"
        :mode-menu-open="sidecarModeMenuOpen"
        :model="sidecarModel"
        :model-menu-open="sidecarModelMenuOpen"
        :references="sidecarReferences"
        :selection-message-id="sidecarSelectionMessageId"
        :selection-text="sidecarSelectionText"
        :thread-exists="Boolean(sidecarThreadId || restoredSidecarThread)"
        @add-selected-reference="addSidecarSelectedReference"
        @clear-references="clearSidecarReferences"
        @close="sidecarOpen = false; sidecarDeleteOpen = false"
        @confirm-delete="deleteSidecarThread"
        @delete-open="sidecarDeleteOpen = true"
        @draft="sidecarDraft = $event"
        @mode-menu="sidecarModeMenuOpen = !sidecarModeMenuOpen"
        @model-menu="sidecarModelMenuOpen = !sidecarModelMenuOpen"
        @select-mode="sidecarMode = $event; sidecarModeMenuOpen = false"
        @select-model="sidecarModel = $event; sidecarModelMenuOpen = false"
        @selection="handleSidecarSelection"
        @submit="submitSidecarMessage"
      />

      <ArtifactPanel
        :artifacts="artifacts"
        :artifact-code-copy-message="artifactCodeCopyMessage"
        :artifact-content="artifactContent.content.value"
        :artifact-content-error="artifactContent.errorMessage.value ? displayArtifactError(artifactContent.errorMessage.value) : null"
        :artifact-content-loading="artifactContent.isLoading.value"
        :artifact-details-visible="artifactDetailsVisible"
        :artifact-html-preview-error-message="artifactHtmlPreviewErrorMessage"
        :artifact-html-preview-iframe-ref="setArtifactHtmlPreviewIframe"
        :artifact-html-preview-url="artifactHtmlPreviewUrl"
        :artifact-panel-open="artifactPanelOpen"
        :artifact-skill-install-error="artifactSkillInstallError"
        :artifact-skill-install-message="artifactSkillInstallMessage"
        :artifact-view-mode="artifactViewMode"
        :artifact-copy-message="artifactCopyMessage"
        :can-install-selected-artifact-skill="canInstallSelectedArtifactSkill"
        :is-installing-artifact-skill="isInstallingArtifactSkill"
        :selected-artifact="selectedArtifact"
        :selected-artifact-can-show-code="selectedArtifactCanShowCode"
        :selected-artifact-can-toggle-view="selectedArtifactCanToggleView"
        :selected-artifact-code-language="selectedArtifactCodeLanguage"
        :selected-artifact-code-line-count="selectedArtifactCodeLineCount"
        :selected-artifact-preview-content="selectedArtifactPreviewContent"
        :selected-artifact-viewer="selectedArtifactViewer"
        :thread-id="threadId"
        @close="setArtifactPanelOpen(false)"
        @copy-artifact-code="copySelectedArtifactCode"
        @copy-artifact-link="copySelectedArtifactLink"
        @install-artifact-skill="installSelectedArtifactSkill"
        @select-artifact="selectArtifactForPreview"
        @select-artifact-detail="selectArtifactFromDetail"
        @set-view-mode="artifactViewMode = $event"
        @toggle="toggleArtifactPanel"
      />
        <BrowserViewPanel :initial-frame="latestBrowserFrame" :open="browserOpen" :thread-id="threadId" @close="browserOpen = false" />
      </WorkspacePanelLayout>
  </WorkspaceChatShell>
</template>
