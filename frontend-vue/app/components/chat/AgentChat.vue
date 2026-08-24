<script setup lang="ts">
/*
  【文件职责】     编排 DeerFlow 主会话、消息、composer 与右侧业务面板。
  【对应 frontend/】 src/components/workspace/chats/chat-box.tsx
  【架构位置】     L3
  【主要导出】     默认 AgentChat 组件
  【依赖关系】     useThreadStream · MessageList · ChatComposer · workspace panels
  【边界与注意】   集成根而非 L2 组件；artifact/sidecar/browser 接线不得反向进入通用层。
*/
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { CalendarClock, Menu, Share2 } from "lucide-vue-next";

import ChatComposer from "@/components/chat/ChatComposer.vue";
import MessageList from "@/components/chat/MessageList.vue";
import AuroraText from "@/components/ui/effects/AuroraText.vue";
import ContextUsageBadge from "@/components/workspace/ContextUsageBadge.vue";
import TodoList from "@/components/workspace/TodoList.vue";
import TokenUsageIndicator from "@/components/chat/TokenUsageIndicator.vue";
import WorkspacePanels from "@/components/workspace/WorkspacePanels.vue";
import ArtifactPanel from "@/components/workspace/artifacts/ArtifactPanel.vue";
import ArtifactTrigger from "@/components/workspace/artifacts/ArtifactTrigger.vue";
import BrowserPanel from "@/components/workspace/browser-view/BrowserPanel.vue";
import BrowserTrigger from "@/components/workspace/browser-view/BrowserTrigger.vue";
import SidecarPanel from "@/components/workspace/sidecar/SidecarPanel.vue";
import { useArtifactsPanel } from "@/composables/useArtifactsPanel";
import { useAgentCreationSession } from "@/composables/useAgentCreationSession";
import { useSidecar } from "@/composables/useSidecar";
import { useSidecarSession } from "@/composables/useSidecarSession";
import { useThreadStream } from "@/composables/useThreadStream";
import { useThreads } from "@/composables/useThreads";
import { useNotifications } from "@/composables/useNotifications";
import { useWorkspaceFeatures } from "@/composables/useWorkspaceFeatures";
import { useAuthSession } from "@/composables/useAuthSession";
import { useModels } from "@/composables/useModels";
import { useThreadSettings } from "@/composables/useThreadSettings";
import { useThreadTokenUsage } from "@/composables/useThreadTokenUsage";
import { branchThreadFromTurn } from "@/core/threads/api";
import { getAPIClient } from "@/core/api/api-client";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";
import { isHiddenFromUIMessage } from "@/core/messages/utils";
import type { FileInMessage } from "@/core/messages/utils";
import {
  buildHumanInputResponseText,
  type HumanInputRequest,
  type HumanInputResponse,
} from "@/core/messages/human-input";
import {
  AUTH_DISABLED_USER,
  isAuthDisabledMode,
} from "@/core/auth/auth-disabled-user";
import {
  DEFAULT_MAX_SUGGESTIONS,
  loadSuggestionsConfig,
} from "@/core/suggestions/api";
import type { Message } from "@/core/types/message";
import {
  selectContextUsage,
  threadTokenUsageToTokenUsage,
} from "@/core/threads/token-usage";
import type { GoalState } from "@/core/threads/types";
import type { Todo } from "@/core/todos";
import {
  buildReferenceMessageMetadata,
  type SidecarContext,
} from "@/core/sidecar";
import { buildWriteFileArtifactURL } from "@/core/artifacts/utils";
import { getAgent } from "@/core/agents/api";
import { buildAgentSaveSubmission } from "@/core/agents/creation-session";
import { agentKeys } from "@/core/agents/query-keys";
import type { Agent } from "@/core/agents/types";
import { resolveComposerModel } from "@/core/models/capabilities";
import { createAsyncGeneration } from "@/core/async/generation";
import {
  latestBrowserViewFrame,
  reconcileBrowserMessageFrame,
  type BrowserViewFrame,
} from "@/core/browser/frame";

const props = defineProps<{
  agentName?: string | null;
  bootstrap?: boolean;
  demo?: boolean;
}>();
const { $i18n } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const threads = useThreads();
const queryClient = useQueryClient();
const isDemo = computed(
  () => props.demo === true || route.query.mock === "true",
);
const features = useWorkspaceFeatures({ enabled: !isDemo.value });
const notifications = useNotifications();
const authDisabled = isAuthDisabledMode();
const auth = useAuthSession({
  enabled: computed(() => !authDisabled && !isDemo.value),
});
const currentUserId = computed(() => {
  if (authDisabled) return AUTH_DISABLED_USER.id;
  const session = auth.session.value;
  return session?.tag === "authenticated" ? session.user.id : null;
});
const isAdmin = computed(() => {
  if (authDisabled) return AUTH_DISABLED_USER.system_role === "admin";
  const session = auth.session.value;
  return (
    session?.tag === "authenticated" && session.user.system_role === "admin"
  );
});

const routeThreadId = computed(() => {
  const raw = route.params.thread_id;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "new" || !value ? null : value;
});
const initialRouteThreadId = routeThreadId.value;
const streamThreadId = computed(() =>
  isDemo.value ? null : routeThreadId.value,
);
const draftThreadId = ref(globalThis.crypto.randomUUID());
watch(routeThreadId, (id) => {
  if (id === null) draftThreadId.value = globalThis.crypto.randomUUID();
});
const settingsScope = computed(() =>
  [
    props.agentName ? `agent:${props.agentName}` : "lead-agent",
    routeThreadId.value ?? draftThreadId.value,
  ].join(":"),
);
const { settings, update: updateThreadSettings } =
  useThreadSettings(settingsScope);
const context = computed(() => ({
  ...settings.value.context,
  ...(props.agentName ? { agent_name: props.agentName } : {}),
  ...(props.bootstrap ? { is_bootstrap: true } : {}),
}));
const welcomeColors = computed(() =>
  context.value.mode === "ultra"
    ? ["#efefbb", "#e9c665", "#e3a812"]
    : ["var(--color-foreground)"],
);
const warnings = ref<string[]>([]);
const localUploading = ref(false);
const demoMessages = ref<Message[] | null>(null);
const demoArtifacts = ref<string[]>([]);
const demoTitle = ref<string>();
const agent = ref<Agent | null>(null);
const agentResolved = ref(!props.agentName || isDemo.value);
let agentRequest = 0;
const followups = ref<string[]>([]);
const followupsLoading = ref(false);
const suggestionsEnabled = ref(false);
const maxSuggestions = ref(DEFAULT_MAX_SUGGESTIONS);
const composer = ref<InstanceType<typeof ChatComposer> | null>(null);
const failedSend = ref<{ text: string; files: FileInMessage[] } | null>(null);
const mainTailRequest = ref(0);
const mobileSidebarOpen = ref(false);
const threadTokenUsageQuery = useThreadTokenUsage(routeThreadId, {
  enabled: computed(() => !isDemo.value),
});
const threadTokenUsage = threadTokenUsageQuery.usage;
const contextUsage = computed(() => selectContextUsage(threadTokenUsage.value));
const modelCatalog = useModels({ enabled: computed(() => !isDemo.value) });
const selectedModel = computed(() => {
  if (!agentResolved.value) return undefined;
  return resolveComposerModel(
    modelCatalog.models.value,
    typeof context.value.model_name === "string"
      ? context.value.model_name
      : undefined,
    agent.value?.model,
  );
});
const persistedTokenUsage = computed(() =>
  threadTokenUsageToTokenUsage(threadTokenUsage.value),
);
const suggestionGeneration = createAsyncGeneration();
let suggestionController: AbortController | null = null;
const preparedThreadId = ref<string | null>(null);
const editState = ref<{
  messageId: string;
  text: string;
  messageIds: string[];
} | null>(null);
let finishAgentCreationRun: (messages: readonly Message[]) => void = () => {};
let lastStartedThreadId: string | null = null;

const stream = useThreadStream({
  threadId: streamThreadId,
  // Bootstrap creation intentionally stays on /workspace/agents/new until
  // setup_agent succeeds. Keep the prepared real thread visible without
  // enabling route-owned history queries for it.
  displayThreadId: computed(
    () => streamThreadId.value ?? preparedThreadId.value,
  ),
  context,
  model: selectedModel,
  notify: {
    warn: (message) =>
      warnings.value.push(
        message === "conversation.streamReplayGap"
          ? $i18n.t.value.conversation.streamReplayGap
          : message,
      ),
    error: (message) => warnings.value.push(message),
  },
  onStart(startedThreadId) {
    lastStartedThreadId = startedThreadId;
    threads.upsertCreated(
      startedThreadId,
      $i18n.t.value.pages.newChat,
      props.agentName,
    );
    if (routeThreadId.value === null && !props.bootstrap) {
      const path = props.agentName
        ? `/workspace/agents/${encodeURIComponent(props.agentName)}/chats/${startedThreadId}`
        : `/workspace/chats/${startedThreadId}`;
      void router.replace(path);
    }
  },
  onFinish(state, completedMessages) {
    finishAgentCreationRun(completedMessages);
    const id = routeThreadId.value ?? lastStartedThreadId;
    const title = Reflect.get(state, "title");
    const stateTitle = typeof title === "string" && title.trim() ? title : null;
    if (id && typeof title === "string" && title.trim()) {
      const existing = threads.threads.find((item) => item.thread_id === id);
      if (existing) {
        threads.upsert({
          ...existing,
          values: { ...existing.values, title },
        });
      }
    }
    queueMicrotask(() => void refreshPostRun(id));
    // A new chat adopts its real route id asynchronously in onStart. The final
    // wire message can therefore become visible shortly after `onFinish`.
    // Bound the wait instead of emitting an irreversibly body-less notification.
    const notifyWhenFinalMessageIsVisible = (remainingAttempts: number) => {
      if (document.hasFocus()) return;
      const completedMessages = Reflect.get(state, "messages");
      const stateMessages = Array.isArray(completedMessages)
        ? completedMessages.filter(
            (message): message is Message =>
              typeof message === "object" &&
              message !== null &&
              Reflect.get(message, "type") === "ai",
          )
        : [];
      const lastAssistant = [...stateMessages, ...visibleMessages.value]
        .reverse()
        .find((message) => message.type === "ai");
      const listedTitle = id
        ? threads.threads.find((thread) => thread.thread_id === id)?.values
            .title
        : null;
      const refreshedTitle =
        typeof listedTitle === "string" &&
        listedTitle.trim() &&
        listedTitle !== $i18n.t.value.pages.newChat
          ? listedTitle
          : null;
      const notificationTitle =
        stateTitle ??
        refreshedTitle ??
        $i18n.t.value.conversation.newChatNotificationTitle;
      const titleReady = stateTitle !== null || refreshedTitle !== null;
      if ((!lastAssistant || !titleReady) && remainingAttempts > 0) {
        completionNotificationTimer = setTimeout(
          () => notifyWhenFinalMessageIsVisible(remainingAttempts - 1),
          25,
        );
        return;
      }
      notifications.showNotification(notificationTitle, {
        body: lastAssistant ? messageText(lastAssistant) : undefined,
      });
    };
    completionNotificationTimer = setTimeout(
      () => notifyWhenFinalMessageIsVisible(8),
      0,
    );
  },
});
const creation = useAgentCreationSession({
  agentName: () => props.agentName ?? "",
  submitSave: (signal) => {
    const submission = buildAgentSaveSubmission(
      $i18n.t.value.agents.saveCommandMessage,
    );
    return send(submission.text, submission.files, {
      additionalKwargs: submission.additionalKwargs,
      signal,
      reportFailure: false,
    });
  },
  loadAgent: (name, signal) => getAgent(name, { signal }),
  async onCreated(created) {
    agent.value = created;
    agentResolved.value = true;
    queryClient.setQueryData(agentKeys.detail(created.name), created);
    queryClient.setQueryData<Agent[]>(agentKeys.list(), (rows) => {
      const current = rows ?? [];
      return current.some((row) => row.name === created.name)
        ? current.map((row) => (row.name === created.name ? created : row))
        : [...current, created];
    });
    await queryClient.invalidateQueries({
      queryKey: agentKeys.list(),
      exact: true,
    });
  },
  copy: {
    saveNotAccepted: $i18n.t.value.agents.saveNotAccepted,
    loadFailed: $i18n.t.value.agents.creationLoadFailed,
    visibilityUnavailable: $i18n.t.value.agents.creationVisibilityUnavailable,
    requestFailed: $i18n.t.value.agents.creationRequestFailed,
    missingToolResult: $i18n.t.value.agents.creationMissingToolResult,
    runFailed: $i18n.t.value.agents.creationRunFailed,
  },
});
finishAgentCreationRun = (messages) => {
  if (props.bootstrap) void creation.onRunFinished(messages);
};
watch(stream.error, (error) => {
  if (props.bootstrap && error) creation.onRunError(error);
});
const creationBusy = computed(
  () =>
    creation.status.value === "saving" || creation.status.value === "verifying",
);
const authoritativeArtifacts = computed(() => {
  if (isDemo.value) return demoArtifacts.value;
  const state = stream.state.value;
  const value = Object.prototype.hasOwnProperty.call(state, "artifacts")
    ? Reflect.get(state, "artifacts")
    : threads.threads.find((thread) => thread.thread_id === routeThreadId.value)
        ?.values.artifacts;
  if (value === undefined) return undefined;
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
});
const authoritativeGoal = computed<GoalState | null>(() => {
  const state = stream.state.value;
  if (Object.prototype.hasOwnProperty.call(state, "goal")) {
    return (Reflect.get(state, "goal") as GoalState | null | undefined) ?? null;
  }
  return (
    threads.threads.find((thread) => thread.thread_id === routeThreadId.value)
      ?.values.goal ?? null
  );
});
const localGoal = ref<GoalState | null | undefined>(undefined);
const activeGoal = computed(() =>
  localGoal.value !== undefined ? localGoal.value : authoritativeGoal.value,
);
const authoritativeTodos = computed<Todo[]>(() => {
  const state = stream.state.value;
  const value = Object.prototype.hasOwnProperty.call(state, "todos")
    ? Reflect.get(state, "todos")
    : threads.threads.find((thread) => thread.thread_id === routeThreadId.value)
        ?.values.todos;
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Todo =>
      typeof item === "object" &&
      item !== null &&
      typeof Reflect.get(item, "content") === "string" &&
      ["pending", "in_progress", "completed"].includes(
        String(Reflect.get(item, "status")),
      ),
  );
});
watch(authoritativeGoal, () => {
  localGoal.value = undefined;
});
watch(routeThreadId, () => {
  localGoal.value = undefined;
});
const artifactPanel = useArtifactsPanel({
  threadId: routeThreadId,
  authoritativeArtifacts,
  historyLoading: stream.isHistoryLoading,
});
const sidecar = useSidecar({ parentThreadId: streamThreadId, context });
const sidecarReady = ref(false);
const sidecarSession = useSidecarSession({
  parentThreadId: streamThreadId,
  parentMessages: () => demoMessages.value ?? stream.messages.value,
  sidecarThreadId: sidecar.sidecarThreadId,
  references: sidecar.activeReferences,
  context: sidecar.context,
  onReferencesAccepted: sidecar.clearActiveReferences,
});
const browserOpen = ref(false);
const browserFrame = ref<BrowserViewFrame | null>(null);
const observedBrowserMessageFrame = ref<BrowserViewFrame | null>(null);
const lastAutoOpenedBrowserScreenshot = ref<string | null>(null);
const agentBrowserEnabled = computed(
  () =>
    !props.agentName ||
    (agent.value !== null &&
      (agent.value.tool_groups == null ||
        agent.value.tool_groups.includes("browser"))),
);
const browserEnabled = computed(
  () =>
    Boolean(routeThreadId.value) &&
    !isDemo.value &&
    features.browserControlEnabled.value &&
    agentBrowserEnabled.value,
);
const latestBrowserFrame = computed(() =>
  latestBrowserViewFrame(demoMessages.value ?? stream.messages.value),
);
watch(routeThreadId, () => {
  browserOpen.value = false;
  browserFrame.value = null;
  observedBrowserMessageFrame.value = null;
  lastAutoOpenedBrowserScreenshot.value = null;
});
watch(
  [latestBrowserFrame, browserEnabled],
  ([nextFrame, enabled]) => {
    if (!nextFrame) return;
    const reconciliation = reconcileBrowserMessageFrame(
      browserFrame.value,
      observedBrowserMessageFrame.value,
      nextFrame,
    );
    observedBrowserMessageFrame.value = reconciliation.observed;
    if (reconciliation.changed) {
      browserFrame.value = reconciliation.display;
    }
    if (
      enabled &&
      nextFrame.screenshot !== lastAutoOpenedBrowserScreenshot.value
    ) {
      lastAutoOpenedBrowserScreenshot.value = nextFrame.screenshot;
      browserOpen.value = true;
    }
  },
  { immediate: true },
);
watch(browserEnabled, (enabled) => {
  if (!enabled) browserOpen.value = false;
});
watch(
  sidecarSession.ready,
  (ready) => {
    sidecarReady.value = ready;
  },
  { immediate: true },
);
const activePanel = computed<"artifacts" | "sidecar" | "browser" | null>(() => {
  if (browserOpen.value && browserEnabled.value) return "browser";
  if (sidecar.open.value) return "sidecar";
  if (artifactPanel.open.value && artifactPanel.selectedArtifact.value)
    return "artifacts";
  return null;
});
const panelOpen = computed(() => activePanel.value !== null);

function openArtifact(path: string, automatic = false) {
  if (!artifactPanel.select(path, automatic)) return;
  browserOpen.value = false;
  sidecar.close();
}
async function toggleSidecar() {
  if (sidecar.open.value) {
    sidecar.close();
    return;
  }
  const restored = await sidecarSession.restore({ force: true });
  if (restored && artifactPanel.close()) {
    browserOpen.value = false;
    sidecar.open.value = true;
  }
}
function openBrowser() {
  if (!artifactPanel.close()) return;
  sidecar.close();
  browserOpen.value = true;
}
function acceptBrowserFrame(frame: BrowserViewFrame) {
  browserFrame.value = frame;
}
function askInSidecar(payload: {
  message: Message;
  selectedText: string;
  displayIndex: number;
}) {
  const next = sidecar.fromSelection(
    payload.message,
    payload.selectedText,
    payload.displayIndex,
  );
  if (!next) return;
  if (!artifactPanel.close()) return;
  sidecar.openContext(next);
}

function showArtifacts() {
  const first = artifactPanel.artifacts.value[0];
  if (
    !artifactPanel.selectedArtifact.value &&
    first &&
    !artifactPanel.select(first)
  ) {
    return;
  }
  if (!artifactPanel.setOpen(true)) return;
  browserOpen.value = false;
  sidecar.close();
}
function addToConversation(payload: {
  message: Message;
  selectedText: string;
  displayIndex: number;
}) {
  const next = sidecar.fromSelection(
    payload.message,
    payload.selectedText,
    payload.displayIndex,
  );
  if (next) sidecar.addContextToConversation(next);
}

function quotePrompt(contexts: SidecarContext[]): Message {
  const blocks = contexts.flatMap((item, index) => [
    `<referenced_message index="${index + 1}" label="${item.label.replaceAll('"', "&quot;")}">`,
    `Role: ${item.role === "user" ? "User" : "Assistant"}`,
    item.messageId ? `Message ID: ${item.messageId}` : "",
    "",
    item.content,
    "</referenced_message>",
    "",
  ]);
  return {
    type: "human",
    content: [
      {
        type: "text",
        text: [
          contexts.length === 1
            ? "The user added the following quoted context to this conversation."
            : `The user added the following ${contexts.length} quoted contexts to this conversation.`,
          "Use the referenced_message blocks as reference material for the user's next message.",
          "",
          ...blocks,
        ].join("\n"),
      },
    ],
    additional_kwargs: {
      hide_from_ui: true,
      conversation_quote_context: true,
      referenced_message_ids: contexts.map((item) => item.messageId ?? ""),
      referenced_message_roles: contexts.map((item) => item.role),
      quote_context_count: contexts.length,
    },
  } as Message;
}

let completionNotificationTimer: ReturnType<typeof setTimeout> | undefined;
const lastAutoOpenedArtifact = ref<string | null>(null);
const autoOpenArtifact = computed(() => {
  const messages = stream.messages.value;
  let target: string | null = null;
  for (const message of messages) {
    if (message.type !== "ai") continue;
    for (const call of message.tool_calls ?? []) {
      const path = call.args?.path;
      if (
        (call.name === "write_file" || call.name === "str_replace") &&
        typeof path === "string"
      ) {
        target = buildWriteFileArtifactURL({
          filepath: path,
          messageId: message.id,
          toolCallId: call.id,
        });
      }
      if (call.name === "finalize_artifact_write" && typeof path === "string") {
        const result = messages.find(
          (candidate) =>
            candidate.type === "tool" && candidate.tool_call_id === call.id,
        );
        if (result && messageText(result).trim() === "OK") target = path;
      }
    }
  }
  return target;
});
watch(
  autoOpenArtifact,
  (target) => {
    if (!target) return;
    const key = `${routeThreadId.value ?? "new"}\u0000${target}`;
    if (key === lastAutoOpenedArtifact.value) return;
    lastAutoOpenedArtifact.value = key;
    openArtifact(target, true);
  },
  { immediate: true },
);

const visibleMessages = computed(() =>
  (demoMessages.value ?? stream.messages.value).filter(
    (message: Message) => !isHiddenFromUIMessage(message),
  ),
);
const pendingUsageMessages = computed(() => {
  if (!stream.isStreaming.value || !stream.activeRunId.value) return [];
  const runId = stream.activeRunId.value;
  return visibleMessages.value.filter(
    (message) => Reflect.get(message, "run_id") === runId,
  );
});
const promptHistory = computed(() =>
  visibleMessages.value
    .filter((message) => message.type === "human")
    .map((message) => {
      if (typeof message.content === "string") return message.content;
      return Array.isArray(message.content)
        ? message.content
            .map((part) =>
              typeof part === "object" && part !== null && "text" in part
                ? String(part.text ?? "")
                : "",
            )
            .join("")
        : "";
    })
    .filter(Boolean),
);
const currentTitle = computed(() => {
  if (isDemo.value && demoTitle.value) return demoTitle.value;
  if (!routeThreadId.value) return $i18n.t.value.pages.newChat;
  return (
    threads.threads.find((thread) => thread.thread_id === routeThreadId.value)
      ?.values.title ?? $i18n.t.value.pages.newChat
  );
});
const isWelcomeMode = computed(
  () => visibleMessages.value.length === 0 && !stream.isHistoryLoading.value,
);

function toggleSidebar() {
  globalThis.dispatchEvent(new CustomEvent("deerflow:toggle-sidebar"));
}
function updateSidebarState(event: Event) {
  mobileSidebarOpen.value = Boolean(
    (event as CustomEvent<{ open?: boolean }>).detail?.open,
  );
}
async function shareConversation() {
  try {
    await globalThis.navigator.clipboard.writeText(globalThis.location.href);
    warnings.value.push($i18n.t.value.clipboard.linkCopied);
  } catch {
    warnings.value.push($i18n.t.value.clipboard.failedToCopyToClipboard);
  }
}

function messageText(message: Message) {
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";
  return message.content
    .map((part) =>
      typeof part === "object" && part !== null && "text" in part
        ? String(part.text ?? "")
        : "",
    )
    .join("");
}

function recentConversation() {
  return visibleMessages.value
    .filter((message) => message.type === "human" || message.type === "ai")
    .map((message) => ({
      role: message.type === "human" ? "user" : "assistant",
      content: messageText(message),
    }))
    .filter((message) => message.content.trim())
    .slice(-6);
}

async function refreshPostRun(targetThreadId: string | null) {
  if (!targetThreadId) return;
  const scope = `${targetThreadId}\u0000${props.agentName ?? "lead-agent"}`;
  const token = suggestionGeneration.begin(scope);
  suggestionController?.abort();
  const controller = new AbortController();
  suggestionController = controller;
  try {
    const refreshed = await getAPIClient().threads.get(targetThreadId);
    if (
      controller.signal.aborted ||
      (routeThreadId.value ?? lastStartedThreadId) !== targetThreadId ||
      !suggestionGeneration.isCurrent(token, scope)
    ) {
      return;
    }
    threads.upsert(refreshed);
  } catch {
    // The stream state remains authoritative while metadata persistence catches up.
  }
  if (
    controller.signal.aborted ||
    (routeThreadId.value ?? lastStartedThreadId) !== targetThreadId ||
    !suggestionGeneration.isCurrent(token, scope)
  ) {
    return;
  }
  await threadTokenUsageQuery.refetch();
  if (!suggestionsEnabled.value) return;
  const messages = recentConversation();
  if (messages.length === 0) return;
  followupsLoading.value = true;
  followups.value = [];
  try {
    const response = await fetchWithAuth(
      `${getBackendBaseURL()}/api/threads/${encodeURIComponent(targetThreadId)}/suggestions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          n: maxSuggestions.value,
          model_name: context.value.model_name,
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) return;
    const body = (await response.json()) as { suggestions?: unknown[] };
    if (
      controller.signal.aborted ||
      routeThreadId.value !== targetThreadId ||
      !suggestionGeneration.isCurrent(token, scope)
    ) {
      return;
    }
    followups.value = (body.suggestions ?? [])
      .flatMap((value) =>
        typeof value === "string" && value.trim() ? [value.trim()] : [],
      )
      .slice(0, maxSuggestions.value);
  } catch {
    if (
      !controller.signal.aborted &&
      suggestionGeneration.isCurrent(token, scope)
    ) {
      followups.value = [];
    }
  } finally {
    if (suggestionGeneration.isCurrent(token, scope)) {
      followupsLoading.value = false;
    }
    if (suggestionController === controller) suggestionController = null;
  }
}

watch([routeThreadId, () => props.agentName], () => {
  suggestionGeneration.invalidate();
  suggestionController?.abort();
  suggestionController = null;
  followupsLoading.value = false;
  followups.value = [];
});

async function ensureThread() {
  if (isDemo.value)
    throw new Error($i18n.t.value.common.notAvailableInDemoMode);
  if (routeThreadId.value) return routeThreadId.value;
  if (preparedThreadId.value) return preparedThreadId.value;
  const created = await getAPIClient().threads.create({
    threadId: draftThreadId.value,
    assistantId: "lead_agent",
    metadata: props.agentName ? { agent_name: props.agentName } : {},
  });
  preparedThreadId.value = created.thread_id;
  threads.upsert(created);
  return created.thread_id;
}

async function send(
  text: string,
  files: FileInMessage[],
  options?: {
    onAccepted?: () => void;
    additionalKwargs?: Record<string, unknown>;
    signal?: AbortSignal;
    reportFailure?: boolean;
  },
) {
  if (isDemo.value) return false;
  followups.value = [];
  mainTailRequest.value += 1;
  try {
    const targetThreadId = await ensureThread();
    const quotes = [...sidecar.conversationQuotes.value];
    const contexts = quotes.map((quote) => quote.context);
    const accepted = await stream.sendMessage(
      targetThreadId,
      { text, files },
      undefined,
      {
        ...(contexts.length || options?.additionalKwargs
          ? {
              ...(contexts.length
                ? { additionalInputMessages: [quotePrompt(contexts)] }
                : {}),
              additionalKwargs: {
                ...options?.additionalKwargs,
                ...(contexts.length
                  ? buildReferenceMessageMetadata(contexts)
                  : {}),
              },
            }
          : {}),
        signal: options?.signal,
        onAccepted: () => {
          if (quotes.length) sidecar.clearConversationQuotes();
          options?.onAccepted?.();
        },
      },
    );
    if (!accepted) return false;
    failedSend.value = null;
    return true;
  } catch (error) {
    if (options?.reportFailure !== false) {
      failedSend.value = { text, files };
      warnings.value.push(
        error instanceof Error
          ? error.message
          : $i18n.t.value.common.requestFailed,
      );
    }
    if (options) throw error;
    return false;
  }
}
async function retrySend() {
  const failed = failedSend.value;
  if (failed) await send(failed.text, failed.files);
}
async function respondHumanInput(
  request: HumanInputRequest,
  response: HumanInputResponse,
) {
  if (isDemo.value) return false;
  const targetThreadId = routeThreadId.value;
  if (!targetThreadId) return false;
  let accepted = false;
  const dispatched = await stream.sendMessage(
    targetThreadId,
    { text: buildHumanInputResponseText(request, response) },
    undefined,
    {
      additionalKwargs: {
        hide_from_ui: true,
        human_input_response: response,
      },
      onAccepted: () => {
        accepted = true;
      },
    },
  );
  return dispatched && accepted;
}

function updateContext(value: Record<string, unknown>) {
  updateThreadSettings("context", value);
}

async function stopRun() {
  suggestionGeneration.invalidate();
  suggestionController?.abort();
  suggestionController = null;
  followupsLoading.value = false;
  await stream.stop();
}
async function branch(messageId: string, messageIds: string[]) {
  if (isDemo.value) return;
  if (!routeThreadId.value) return;
  const original = threads.threads.find(
    (thread) => thread.thread_id === routeThreadId.value,
  );
  const result = await branchThreadFromTurn(routeThreadId.value, {
    messageId,
    messageIds,
    title: original?.values.title,
  });
  const now = new Date().toISOString();
  threads.upsert({
    thread_id: result.thread_id,
    created_at: now,
    updated_at: now,
    metadata: props.agentName ? { agent_name: props.agentName } : {},
    status: "idle",
    values: {
      title: original?.values.title ?? $i18n.t.value.pages.untitled,
      messages: visibleMessages.value,
    },
    interrupts: {},
  });
  const path = props.agentName
    ? `/workspace/agents/${encodeURIComponent(props.agentName)}/chats/${result.thread_id}`
    : `/workspace/chats/${result.thread_id}`;
  await router.push(path);
}
async function regenerate(messageId: string, messageIds: string[]) {
  if (isDemo.value) return;
  if (routeThreadId.value) {
    await stream.regenerateMessage(routeThreadId.value, messageId, messageIds);
  }
}
function beginEdit(messageId: string, text: string, messageIds: string[]) {
  if (isDemo.value) return;
  editState.value = { messageId, text, messageIds };
}
async function updateAndRerun() {
  if (isDemo.value) return;
  if (!routeThreadId.value || !editState.value) return;
  const pending = editState.value;
  editState.value = null;
  await stream.editAndRegenerateMessage(
    routeThreadId.value,
    pending.messageId,
    pending.text,
    pending.messageIds,
  );
}
function resetNewChat() {
  suggestionGeneration.invalidate();
  suggestionController?.abort();
  suggestionController = null;
  followupsLoading.value = false;
  followups.value = [];
  stream.resetView();
  preparedThreadId.value = null;
  draftThreadId.value = globalThis.crypto.randomUUID();
}
onMounted(() => globalThis.addEventListener("deerflow:new-chat", resetNewChat));
onMounted(() =>
  globalThis.addEventListener("deerflow:sidebar-state", updateSidebarState),
);
let bootstrapAgentName: string | null = null;
watch(
  [
    () => props.bootstrap,
    () => props.agentName,
    agentResolved,
    modelCatalog.loading,
    selectedModel,
  ],
  ([bootstrap, agentName, resolved, modelsLoading]) => {
    if (
      !bootstrap ||
      !agentName ||
      isDemo.value ||
      !resolved ||
      modelsLoading ||
      bootstrapAgentName === agentName
    ) {
      return;
    }
    bootstrapAgentName = agentName;
    void send(
      $i18n.t.value.agents.nameStepBootstrapMessage.replace(
        "{name}",
        agentName,
      ),
      [],
    );
  },
  { immediate: true },
);
onMounted(async () => {
  if (isDemo.value) return;
  try {
    const config = await loadSuggestionsConfig();
    suggestionsEnabled.value = config.enabled;
    maxSuggestions.value = config.max_suggestions;
  } catch {
    suggestionsEnabled.value = false;
  }
});
onMounted(async () => {
  if (!isDemo.value || !routeThreadId.value) return;
  try {
    const response = await globalThis.fetch(
      `/demo/threads/${encodeURIComponent(routeThreadId.value)}/thread.json`,
    );
    if (!response.ok) return;
    const fixture = (await response.json()) as {
      values?: { messages?: Message[]; artifacts?: string[]; title?: string };
    };
    demoMessages.value = fixture.values?.messages ?? [];
    demoArtifacts.value = fixture.values?.artifacts ?? [];
    demoTitle.value = fixture.values?.title;
  } catch {
    demoMessages.value = null;
  }
});
onMounted(async () => {
  if (!initialRouteThreadId || isDemo.value) return;
  try {
    const [thread, state] = await Promise.all([
      getAPIClient().threads.get(initialRouteThreadId),
      getAPIClient().threads.getState(initialRouteThreadId),
    ]);
    threads.upsert({
      ...thread,
      values: { ...thread.values, ...state.values },
    });
  } catch {
    await router.replace("/workspace/chats/new");
  }
});
watch(
  [() => props.agentName, isDemo],
  async ([agentName, demo]) => {
    const request = ++agentRequest;
    agent.value = null;
    if (!agentName || demo) {
      agentResolved.value = true;
      return;
    }
    agentResolved.value = false;
    try {
      const resolvedAgent = await getAgent(agentName);
      if (request === agentRequest) agent.value = resolvedAgent;
    } catch {
      if (request === agentRequest) agent.value = null;
    } finally {
      if (request === agentRequest) agentResolved.value = true;
    }
  },
  { immediate: true },
);
onUnmounted(() =>
  globalThis.removeEventListener("deerflow:new-chat", resetNewChat),
);
onUnmounted(() =>
  globalThis.removeEventListener("deerflow:sidebar-state", updateSidebarState),
);
onUnmounted(() => {
  agentRequest += 1;
  clearTimeout(completionNotificationTimer);
  suggestionGeneration.invalidate();
  suggestionController?.abort();
  suggestionController = null;
});
</script>

<template>
  <WorkspacePanels
    :open="panelOpen"
    :panel-size="artifactPanel.panelSize.value"
    :panel-label="
      activePanel === 'artifacts'
        ? $i18n.t.value.common.artifacts
        : activePanel === 'sidecar'
          ? $i18n.t.value.sidecar.title
          : $i18n.t.value.common.browser
    "
    @update:panel-size="artifactPanel.panelSize.value = $event"
    @collapse="
      activePanel === 'sidecar'
        ? sidecar.close()
        : activePanel === 'browser'
          ? (browserOpen = false)
          : artifactPanel.close()
    "
  >
    <template #main>
      <section id="chat" class="relative flex h-full min-h-0 flex-col">
        <header
          class="bg-background/80 absolute top-0 right-0 left-0 z-40 flex h-12 items-center gap-2 px-2 shadow-xs backdrop-blur sm:px-4"
          :class="
            isWelcomeMode
              ? 'bg-background/0 shadow-none backdrop-blur-none'
              : ''
          "
        >
          <button
            v-if="!isDemo"
            type="button"
            data-sidebar="trigger"
            :aria-label="$i18n.t.value.shortcuts.toggleSidebar"
            aria-controls="workspace-sidebar"
            :aria-expanded="mobileSidebarOpen"
            class="hover:bg-accent flex size-8 items-center justify-center rounded-md md:hidden"
            @click="toggleSidebar"
          >
            <Menu :size="18" />
          </button>
          <div class="min-w-0 flex-1 truncate text-sm font-medium">
            {{ currentTitle }}
          </div>
          <TokenUsageIndicator
            v-if="!isDemo && modelCatalog.tokenUsageEnabled.value"
            :thread-id="routeThreadId"
            :messages="visibleMessages"
            :pending-messages="pendingUsageMessages"
            :backend-usage="persistedTokenUsage"
            :context-usage="contextUsage"
            :enabled="modelCatalog.tokenUsageEnabled.value"
            :preferences="settings.tokenUsage"
            @preferences-change="updateThreadSettings('tokenUsage', $event)"
          />
          <ContextUsageBadge
            v-else-if="!isDemo"
            :context-usage="contextUsage"
          />
          <span
            v-if="agentName"
            class="bg-secondary text-secondary-foreground rounded-full px-2.5 py-1 text-xs"
            >{{ agentName }}</span
          >
          <button
            v-if="bootstrap"
            type="button"
            data-testid="agent-save"
            class="rounded-md border px-3 py-1.5 text-xs"
            :disabled="
              stream.isStreaming.value ||
              creationBusy ||
              creation.status.value === 'created'
            "
            @click="creation.save"
          >
            {{
              creation.status.value === "verifying"
                ? $i18n.t.value.agents.verifying
                : creation.status.value === "created"
                  ? $i18n.t.value.agents.agentCreated
                  : creation.status.value === "saving" ||
                      stream.isStreaming.value
                    ? $i18n.t.value.agents.saving
                    : $i18n.t.value.agents.save
            }}
          </button>
          <ArtifactTrigger
            :count="artifactPanel.artifacts.value.length"
            @open="showArtifacts"
          />
          <BrowserTrigger v-if="browserEnabled" @open="openBrowser" />
          <NuxtLink
            v-if="routeThreadId && !isDemo"
            :to="`/workspace/scheduled-tasks?thread_id=${encodeURIComponent(routeThreadId)}`"
            :aria-label="$i18n.t.value.sidebar.scheduledTasks"
            class="text-muted-foreground hover:bg-accent flex size-8 items-center justify-center rounded-md"
          >
            <CalendarClock :size="16" />
          </NuxtLink>
          <button
            v-if="!isDemo && sidecar.sidecarThreadId.value && sidecarReady"
            type="button"
            data-testid="sidecar-header-trigger"
            :aria-label="
              sidecar.open.value
                ? $i18n.t.value.sidecar.close
                : $i18n.t.value.sidecar.open
            "
            class="text-muted-foreground hover:bg-accent flex size-8 items-center justify-center rounded-md"
            @click="toggleSidecar"
          >
            ◫
          </button>
          <button
            v-if="!isWelcomeMode && !isDemo"
            type="button"
            :aria-label="$i18n.t.value.common.share"
            class="text-muted-foreground hover:bg-accent flex size-8 items-center justify-center rounded-md"
            @click="shareConversation"
          >
            <Share2 :size="16" />
          </button>
        </header>
        <MessageList
          :class="isWelcomeMode ? '' : 'pt-10'"
          :messages="visibleMessages"
          :raw-messages="demoMessages ?? stream.messages.value"
          :streaming="stream.isStreaming.value"
          :loading="stream.isHistoryLoading.value"
          :thread-id="routeThreadId"
          :artifact-paths="artifactPanel.artifacts.value"
          :is-mock="isDemo"
          :subtasks="stream.subtasks.value"
          :active-run-id="stream.activeRunId.value"
          :has-more-history="stream.hasMoreHistory.value"
          :history-loading-more="stream.isHistoryLoadingMore.value"
          :history-error="stream.historyError.value"
          :thread-error="stream.error.value"
          :submit-human-input="respondHumanInput"
          :token-usage-inline-mode="
            modelCatalog.tokenUsageEnabled.value
              ? settings.tokenUsage.inlineMode
              : 'off'
          "
          :tail-request="mainTailRequest"
          :interactive="!isDemo"
          selection-mode="main"
          test-id="main-message-list"
          @artifact="openArtifact"
          @selection-ask="askInSidecar"
          @selection-add="addToConversation"
          @branch="branch"
          @regenerate="regenerate"
          @edit="beginEdit"
          @human-input="respondHumanInput"
          @load-more-history="stream.loadMoreHistory()"
        />
        <div
          v-if="editState"
          class="border-border bg-background absolute right-0 bottom-36 left-0 z-40 mx-auto w-full max-w-xl rounded-xl border p-3 shadow-lg"
        >
          <textarea
            v-model="editState.text"
            rows="3"
            class="border-input w-full rounded-md border p-2"
          />
          <div class="mt-2 flex justify-end gap-2">
            <button
              type="button"
              class="rounded border px-3 py-1"
              @click="editState = null"
            >
              {{ $i18n.t.value.common.cancel }}
            </button>
            <button
              type="button"
              class="bg-primary text-primary-foreground rounded px-3 py-1"
              @click="updateAndRerun"
            >
              {{ $i18n.t.value.common.updateAndRerun }}
            </button>
          </div>
        </div>
        <p
          v-if="stream.llmRetry.value"
          data-testid="llm-retry-status"
          role="status"
          class="absolute right-4 bottom-48 z-40 max-w-md rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700 shadow"
        >
          {{ stream.llmRetry.value.message }}
        </p>
        <p
          v-if="warnings.length"
          role="status"
          class="absolute right-4 bottom-36 z-40 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700 shadow"
        >
          {{ warnings.at(-1) }}
          <button
            v-if="failedSend"
            type="button"
            class="ml-2 underline"
            @click="retrySend"
          >
            {{ $i18n.t.value.navigation.tryAgain }}
          </button>
        </p>
        <div
          v-if="bootstrap && creation.status.value === 'error'"
          data-testid="agent-creation-error"
          role="alert"
          class="absolute right-4 bottom-36 left-4 z-40 mx-auto max-w-xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 shadow"
        >
          <strong>{{ $i18n.t.value.agents.creationError }}:</strong>
          {{ creation.error.value }}
          <button type="button" class="ml-2 underline" @click="creation.retry">
            {{ $i18n.t.value.agents.retry }}
          </button>
        </div>
        <div
          class="right-0 bottom-0 left-0 z-30 flex justify-center px-3 sm:px-4"
          :class="isWelcomeMode ? 'absolute' : 'relative shrink-0 pb-4'"
        >
          <div
            class="relative w-full"
            :class="[
              isWelcomeMode
                ? 'max-w-[var(--container-width-sm)] -translate-y-[calc(50vh-96px)]'
                : 'max-w-[var(--container-width-md)]',
            ]"
          >
            <section
              v-if="
                bootstrap &&
                creation.status.value === 'created' &&
                creation.agent.value
              "
              data-testid="agent-created"
              class="bg-background mx-auto w-full max-w-lg rounded-xl border p-6 text-center shadow-sm"
            >
              <div class="text-3xl" aria-hidden="true">✓</div>
              <h2 class="mt-2 text-xl font-semibold">
                {{ $i18n.t.value.agents.agentCreated }}
              </h2>
              <p class="text-muted-foreground mt-2 text-sm">
                {{ creation.agent.value.name }} ·
                {{ creation.agent.value.description }}
              </p>
              <div class="mt-5 flex flex-wrap justify-center gap-2">
                <NuxtLink
                  :to="`/workspace/agents/${encodeURIComponent(creation.agent.value.name)}/chats/new`"
                  class="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
                >
                  {{ $i18n.t.value.agents.startChatting }}
                </NuxtLink>
                <NuxtLink
                  to="/workspace/agents"
                  class="rounded-md border px-3 py-2 text-sm"
                >
                  {{ $i18n.t.value.agents.backToGallery }}
                </NuxtLink>
              </div>
            </section>
            <div
              v-if="
                isWelcomeMode &&
                !(bootstrap && creation.status.value === 'created')
              "
              class="mx-auto flex w-full flex-col items-center justify-center gap-2 px-4 py-4 text-center sm:px-8"
            >
              <div
                class="flex flex-wrap items-center justify-center gap-2 text-2xl font-bold"
              >
                <span aria-hidden="true">👋</span>
                <AuroraText :colors="welcomeColors">
                  {{ $i18n.t.value.welcome.greeting }}
                </AuroraText>
              </div>
              <p
                class="text-muted-foreground max-w-full text-sm whitespace-pre-line"
              >
                {{ $i18n.t.value.welcome.description }}
              </p>
            </div>
            <div
              v-if="
                !isWelcomeMode && (followupsLoading || followups.length > 0)
              "
              v-show="!(bootstrap && creation.status.value === 'created')"
              data-slot="suggestions-list"
              class="mb-2 flex w-full flex-wrap justify-center gap-2"
            >
              <span
                v-if="followupsLoading"
                class="text-muted-foreground bg-background/80 rounded-full border px-4 py-1.5 text-xs backdrop-blur-sm"
              >
                {{ $i18n.t.value.inputBox.followupLoading }}
              </span>
              <button
                v-for="suggestion in followups"
                :key="suggestion"
                type="button"
                class="text-muted-foreground bg-background hover:bg-accent rounded-full border px-3 py-1.5 text-xs"
                @click="composer?.offerFollowup(suggestion)"
              >
                {{ suggestion }}
              </button>
              <button
                v-if="followups.length"
                type="button"
                :aria-label="$i18n.t.value.common.close"
                class="text-muted-foreground bg-background hover:bg-accent rounded-full border px-2.5 py-1.5 text-xs"
                @click="followups = []"
              >
                ×
              </button>
            </div>
            <TodoList
              v-if="
                authoritativeTodos.length &&
                !(bootstrap && creation.status.value === 'created')
              "
              :todos="authoritativeTodos"
              class="mb-2"
            />
            <ChatComposer
              v-if="!(bootstrap && creation.status.value === 'created')"
              ref="composer"
              :thread-key="routeThreadId ?? 'new'"
              :target-thread-id="routeThreadId ?? draftThreadId"
              :user-id="currentUserId"
              :agent-name="agentName"
              :default-model-name="agent?.model"
              :model-selection-ready="agentResolved"
              :streaming="stream.isStreaming.value"
              :uploading="localUploading"
              :is-welcome="isWelcomeMode"
              :show-welcome-suggestions="route.query.mode !== 'skill'"
              :prompt-history="promptHistory"
              :ensure-thread="ensureThread"
              :submit-message="send"
              :references="sidecar.conversationQuotes.value"
              :context="context"
              :goal="activeGoal"
              :disabled="isDemo"
              @send="send"
              @stop="stopRun"
              @uploading-change="
                localUploading = $event;
                stream.isUploading.value = $event;
              "
              @clear-references="sidecar.clearConversationQuotes()"
              @context-change="updateContext"
              @goal-change="localGoal = $event"
            />
          </div>
        </div>
      </section>
    </template>
    <template #panel>
      <ArtifactPanel
        v-if="
          activePanel === 'artifacts' &&
          routeThreadId &&
          artifactPanel.selectedArtifact.value
        "
        :thread-id="routeThreadId"
        :selected="artifactPanel.selectedArtifact.value"
        :artifacts="artifactPanel.artifacts.value"
        :opened-presented-artifacts="
          artifactPanel.openedPresentedArtifacts.value
        "
        :messages="demoMessages ?? stream.messages.value"
        :streaming="stream.isStreaming.value"
        :is-mock="isDemo"
        :is-admin="isAdmin"
        :draft-owner="artifactPanel.draftOwner"
        @close="artifactPanel.close()"
        @select="artifactPanel.select($event)"
      />
      <SidecarPanel
        v-if="routeThreadId && activePanel === 'sidecar'"
        :session="sidecarSession"
        :references="sidecar.activeReferences.value"
        :context="sidecar.context"
        :active="activePanel === 'sidecar'"
        @update:context="sidecar.setContext($event)"
        @clear-references="sidecar.clearActiveReferences()"
        @add-reference="sidecar.openContext($event)"
        @close="sidecar.close()"
        @deleted="sidecar.clearThreadAndClose()"
      />
      <BrowserPanel
        v-if="routeThreadId && activePanel === 'browser'"
        :key="routeThreadId"
        :thread-id="routeThreadId"
        :active="activePanel === 'browser'"
        :frame="browserFrame"
        @frame="acceptBrowserFrame"
        @close="browserOpen = false"
      />
    </template>
  </WorkspacePanels>
</template>
