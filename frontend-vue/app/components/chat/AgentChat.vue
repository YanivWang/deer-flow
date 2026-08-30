<script setup lang="ts">
/*
  【文件职责】     编排 DeerFlow 主会话、消息、composer 与右侧业务面板。
  【架构位置】     L3
  【主要导出】     默认 AgentChat 组件
  【依赖关系】     useThreadStream · MessageList · ChatComposer · workspace panels
  【边界与注意】   集成根而非 L2 组件；artifact/sidecar/browser 接线不得反向进入通用层。
*/
import {
  computed,
  defineAsyncComponent,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { Bot, CalendarClock, Menu, PlusSquare } from "lucide-vue-next";

import AgentWelcome from "@/components/chat/AgentWelcome.vue";
import ChatComposer from "@/components/chat/ChatComposer.vue";
import MessageList from "@/components/chat/MessageList.vue";
import { buttonVariants } from "@/components/ui/button";
import AuroraText from "@/components/ui/effects/AuroraText.vue";
import ContextUsageBadge from "@/components/workspace/ContextUsageBadge.vue";
import TodoList from "@/components/workspace/TodoList.vue";
import TokenUsageIndicator from "@/components/chat/TokenUsageIndicator.vue";
import WorkspacePanels from "@/components/workspace/WorkspacePanels.vue";
import ArtifactOverview from "@/components/workspace/artifacts/ArtifactOverview.vue";
import ArtifactTrigger from "@/components/workspace/artifacts/ArtifactTrigger.vue";
import BrowserPanel from "@/components/workspace/browser-view/BrowserPanel.vue";
import BrowserTrigger from "@/components/workspace/browser-view/BrowserTrigger.vue";
import ExportTrigger from "@/components/workspace/ExportTrigger.vue";
import SidecarPanel from "@/components/workspace/sidecar/SidecarPanel.vue";
import { useArtifactsPanel } from "@/composables/useArtifactsPanel";
import { useAgentCreationSession } from "@/composables/useAgentCreationSession";
import { useSidecar } from "@/composables/useSidecar";
import { useSidecarSession } from "@/composables/useSidecarSession";
import { useThreadStream } from "@/composables/useThreadStream";
import { useThreads } from "@/composables/useThreads";
import { useNotifications } from "@/composables/useNotifications";
import { useSuggestionsConfig } from "@/composables/useSuggestionsConfig";
import { useBrowserControlEnabled } from "@/composables/useWorkspaceFeatures";
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
import { DEFAULT_MAX_SUGGESTIONS } from "@/core/suggestions/api";
import type { Message, ToolCall } from "@/core/types/message";
import {
  selectContextUsage,
  threadTokenUsageToTokenUsage,
} from "@/core/threads/token-usage";
import {
  isThreadMissingError,
  shouldLeaveMissingThread,
  type ThreadPresence,
} from "@/core/threads/thread-presence";
import type { AgentThread, GoalState } from "@/core/threads/types";
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

/*
  Artifacts 面板按需加载。它已经在 `v-if` 后面——面板关着时一个 DOM 都不渲染，
  但静态 import 让它的整棵依赖树进了聊天首屏，其中最重的是 `ArtifactPreview`
  经 `rawHtmlRehypePlugins` 拉来的 `rehype-raw` → **parse5**：一个完整的 HTML
  解析器，实测占 `vendor-markdown` chunk 源码体积的 24.8%（276,427 B），加上它
  的 `entities`（70,037 B）与 hast 转换层接近三分之一。而消息渲染路径**从不
  使用 raw HTML**——`plugins.ts` 的文件头就写着这件事：DeerFlow 消息路径整条
  替换了 Streamdown 默认链，raw HTML 走 `remarkHtmlToText` 变成转义文本。
  换句话说，每个只是来聊天的用户都在为产物预览的 HTML 解析器付费。

  面板由用户点击打开，这时再取 chunk 与 CodeBlock/Mermaid/KaTeX 是同一套做法。
*/
/*
  懒加载期间要有话说。React 的 dynamic() 给这三个面板都配了 `loading:`，渲染的是
  `<p role="status">Loading panel…</p>`（chats/chat-box.tsx 的 RightPanelLoading）。
  没有它，chunk 还在路上的那段时间读屏器听到的是一个空面板——用户点了没反应。
  文案是 React 写死的英文，与 primitives 段同一类，放词典里两份同值。
*/
const RightPanelLoading = defineComponent({
  name: "RightPanelLoading",
  setup() {
    const { $i18n } = useNuxtApp();
    return () =>
      h("div", { class: "grid size-full place-items-center" }, [
        h(
          "p",
          { role: "status", class: "text-muted-foreground text-sm" },
          $i18n.t.value.primitives.loadingPanel,
        ),
      ]);
  },
});

const ArtifactPanel = defineAsyncComponent({
  loader: () => import("@/components/workspace/artifacts/ArtifactPanel.vue"),
  loadingComponent: RightPanelLoading,
  delay: 0,
});

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
const features = useBrowserControlEnabled({ enabled: !isDemo.value });
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
const suggestionsConfigQuery = useSuggestionsConfig({
  enabled: computed(() => !isDemo.value),
});
const maxSuggestions = computed(
  () =>
    suggestionsConfigQuery.data.value?.max_suggestions ??
    DEFAULT_MAX_SUGGESTIONS,
);
const composer = ref<InstanceType<typeof ChatComposer> | null>(null);
const failedSend = ref<{ text: string; files: FileInMessage[] } | null>(null);
const mainTailRequest = ref(0);
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
/**
 * `GET /threads/{id}` 的探测结果，和它属于哪个 thread 绑在一起。
 * 只带一个裸 presence 会在切换 thread 后把上一条线程的结论用在新线程上。
 */
const threadPresence = ref<{ threadId: string; presence: ThreadPresence }>({
  threadId: initialRouteThreadId ?? "",
  presence: "unknown",
});
const editState = ref<{
  messageId: string;
  text: string;
  messageIds: string[];
} | null>(null);
const bootstrapConversationReady = ref(!props.bootstrap);
const bootstrapConversationFinished = ref(!props.bootstrap);
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
    if (props.bootstrap && !bootstrapConversationReady.value) {
      bootstrapConversationFinished.value = true;
    }
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
    queueMicrotask(() => void refreshPostRun(id, completedMessages));
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
/*
  Sidecar 的父 thread 用**草稿 id**，不是 streamThreadId。

  streamThreadId 在 /chats/new 上刻意是 null——后端还没有这条 thread，拉历史会 404
  （React 用 `threadId: isNewThread ? undefined : threadId` 表达同一件事）。但 sidecar
  的父级不是「要拉历史的那条 thread」，而是「这一页代表的那次会话」，React 传的正是
  同一个客户端生成的 id（frontend/src/components/workspace/chats/chat-page.tsx 的
  `<SidecarProvider parentThreadId={threadId}>`），上传限额两边也已经用的是它。

  用 null 的代价不是少发一个请求，而是 sidecar 生命周期在新会话页上根本没装上：
  父级一旦从 null 变成真 id，恢复流程才第一次跑起来，中间这段时间侧边会话的状态是
  未定义的。
*/
const sidecarParentThreadId = computed(() =>
  isDemo.value ? null : (routeThreadId.value ?? draftThreadId.value),
);
const sidecar = useSidecar({
  parentThreadId: sidecarParentThreadId,
  context,
});
const sidecarReady = ref(false);
const sidecarSession = useSidecarSession({
  parentThreadId: sidecarParentThreadId,
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
/*
  artifacts 面板开着就是开着，与「有没有选中文件」无关。

  React 的 activeRightPanel 只看 artifactsOpen（frontend/src/components/workspace/chats/chat-box.tsx），
  没选中文件时面板落在文件清单上，而不是不开。原来这里多要一个 selectedArtifact，
  于是头部入口必须先替用户选一个文件，面板才肯出现——那正是下面 showArtifacts()
  里那段自动选中的由来。
*/
const activePanel = computed<"artifacts" | "sidecar" | "browser" | null>(() => {
  // 优先级照 React：sidecar > browser > artifacts
  // （frontend/src/components/workspace/chats/chat-box.tsx 的 activeRightPanel）。
  // 原来是 browser 排在 sidecar 前面：两个都开着时两个应用显示的不是同一个面板。
  if (sidecar.open.value) return "sidecar";
  if (browserOpen.value && browserEnabled.value) return "browser";
  if (artifactPanel.open.value) return "artifacts";
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
function toggleBrowser() {
  if (browserOpen.value) {
    browserOpen.value = false;
    return;
  }
  openBrowser();
}
function acceptBrowserFrame(frame: BrowserViewFrame) {
  browserFrame.value = frame;
}
function openBrowserFrame(frame: BrowserViewFrame) {
  acceptBrowserFrame(frame);
  openBrowser();
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

/*
  只开面板，不替用户选文件——React 的 ArtifactTrigger 就只有
  `sidecar?.close(); setArtifactsOpen(true);`
  （frontend/src/components/workspace/artifacts/artifact-trigger.tsx）。
  自动选中看起来省一步，代价是面板会去拉那个文件的内容，用户并没有要求它这么做。
*/
function showArtifacts() {
  // React 的 ArtifactTrigger 只做这两件事：关掉 sidecar、打开 artifacts
  // （artifacts/artifact-trigger.tsx）。**不**关浏览器面板——浏览器排在 artifacts
  // 前面，所以它开着的时候这颗按钮只是把 artifacts 标成待展开，等浏览器关掉才生效。
  if (!artifactPanel.setOpen(true)) return;
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
/*
  自动打开只发生在两种情况，与 React 的 ToolCall 一一对应
  （frontend/src/components/workspace/messages/message-group.tsx 的
  `autoOpenArtifactUrl`）：

    - 这一轮**正在流式**、最后一个工具调用是 write_file / str_replace、而且它还没
      返回——用户在看模型现场写这个文件；
    - 最后一个工具调用是 finalize_artifact_write 且结果成功——产物已经落地。

  两条判据都少不得。原来这里扫全部消息、只要见到 write_file 就设 target，于是
  **打开任何一条带 write_file 的历史线程都会自动展开面板并收起侧栏**，而 React 那边
  `isLoading` 为假、`finalizedArtifactPath` 为空，什么都不会发生。

  取的是最后一个**写产物**的调用，不是最后一个工具调用。React 的判据是 `isLast`
  （每个 group 只有最后一个工具步骤带它），它靠的是「流式过程中 write_file 曾经是最后
  一步」这一瞬间：那一刻 effect 触发、面板打开，之后再来别的工具调用也不会关掉它。
  Vue 的渲染消息流是降频过的（useCoalescedStreamMessages，每 80ms 至多一帧），
  那一瞬间不保证会成为独立的一帧——实测真 Gateway 回放里 write_file 与随后的 read_file
  落在同一帧，按「最后一个工具调用」判，面板一次都不会开
  （tests/e2e-real/artifact-write.spec.ts 当场变红）。
*/
const ARTIFACT_WRITE_TOOLS = new Set([
  "write_file",
  "str_replace",
  "finalize_artifact_write",
]);

function artifactWriteCallIds(messages: Message[]) {
  const ids: string[] = [];
  for (const message of messages) {
    if (message.type !== "ai") continue;
    for (const call of message.tool_calls ?? []) {
      if (ARTIFACT_WRITE_TOOLS.has(call.name) && call.id) ids.push(call.id);
    }
  }
  return ids;
}

/*
  进入这条线程时**已经在历史里**的写产物调用。

  React 用 `isLoading`（这一轮还在流式）区分「模型正在写」与「翻旧账」。Vue 抄不了
  这个信号：渲染用的消息流被降频成每 80ms 至多一帧（useCoalescedStreamMessages），
  写文件那一帧落在流式结束之前还是之后并不确定——实测两条真 Gateway 用例一条落在
  之前、一条落在之后，用 isStreaming 判会一条绿一条红。

  换成按**来源**判：历史里就有的不开，本次运行新出现的才开。这与 React 想表达的是
  同一件事，而且不依赖任何时序。
*/
const historyArtifactCallIds = ref<Set<string> | null>(null);
/*
  快照只在**换一条线程**时作废，不能绑在 isHistoryLoading 上。

  绑在加载状态上时有这么一条路径：`/chats/new` 上发出第一条消息 → 路由拿到真 id →
  页面为这个新 id 拉一次历史 → isHistoryLoading 变 true → 快照被清成 null →
  加载结束时用**当时**的 messages 重新取快照，而本次流式产生的 write_file 早就在
  里面了。于是「模型此刻正在写的这个文件」被判成「历史里本来就有」，面板永远不开。
  开不开取决于 tool call 与历史加载谁先到——e2e-real 实测约 1/3 的运行里不开，
  同时打挂 real-backend-render 的截图与 artifact-write 的行为断言。

  `/chats/new` 拿到自己的 id **不是**换线程，是同一段对话拿到了 id，所以那一次不作废。
*/
watch(routeThreadId, (threadId, previousThreadId) => {
  if (previousThreadId == null && threadId) return;
  historyArtifactCallIds.value = null;
});
watch(
  () => stream.isHistoryLoading.value,
  (loading) => {
    if (loading) return;
    historyArtifactCallIds.value ??= new Set(
      artifactWriteCallIds(stream.messages.value),
    );
  },
  { immediate: true },
);

const autoOpenArtifact = computed(() => {
  const messages = stream.messages.value;
  let lastCall: ToolCall | undefined;
  let lastCallMessageId: string | undefined;
  for (const message of messages) {
    if (message.type !== "ai") continue;
    for (const call of message.tool_calls ?? []) {
      if (!ARTIFACT_WRITE_TOOLS.has(call.name)) continue;
      lastCall = call;
      lastCallMessageId = message.id;
    }
  }
  const path = lastCall?.args?.path;
  if (!lastCall || typeof path !== "string") return null;

  const result = messages.find(
    (candidate) =>
      candidate.type === "tool" && candidate.tool_call_id === lastCall.id,
  );
  if (lastCall.name === "finalize_artifact_write") {
    // React 的 isSuccessfulToolResult：trimStart().startsWith("OK")。
    return result && messageText(result).trimStart().startsWith("OK")
      ? path
      : null;
  }
  if (lastCall.name !== "write_file" && lastCall.name !== "str_replace") {
    return null;
  }
  /*
    React 在这里还要求「工具**还没返回**」（`isLoading && url && !result`）。两条判据
    合起来说的是「这是模型此刻正在写的那个文件」；Vue 用「它不在进入线程时的历史里」
    表达同一件事，理由见 historyArtifactCallIds 上面那段。
  */
  const history = historyArtifactCallIds.value;
  if (!history || (lastCall.id && history.has(lastCall.id))) return null;
  return buildWriteFileArtifactURL({
    filepath: path,
    messageId: lastCallMessageId,
    toolCallId: lastCall.id,
  });
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

/**
 * 只有「元数据确认缺失 + 历史已问出结论 + 确实一条消息都没有」才放弃这个 URL。
 *
 * 之前这里是 `onMounted` 的 catch 直接 `router.replace`：checkpoint 一 404 就跳。
 * 而上下文压缩之后 checkpoint 本来就不再持有旧消息，`/threads/{id}` 与 `/state`
 * 双双 404，`/threads/{id}/messages/page` 却仍然能完整返回这段会话——用户于是被
 * 静默送回新会话，对话看起来凭空消失。判据必须是「后端还能不能给出这段会话」。
 */
watch(
  () =>
    shouldLeaveMissingThread({
      presence:
        threadPresence.value.threadId === routeThreadId.value
          ? threadPresence.value.presence
          : "unknown",
      historySettled: stream.isHistorySettled.value,
      hasMessages: visibleMessages.value.length > 0,
    }),
  (leave) => {
    if (leave) void router.replace("/workspace/chats/new");
  },
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
/*
  头部上真正显示出来的标题。currentTitle 带「新对话」兜底，那是给标签页用的；
  头部只显示会话真的有的标题（React 的 ThreadTitle 就是这样）。
*/
const headerTitle = computed(() => {
  if (isDemo.value && demoTitle.value) return demoTitle.value;
  if (!routeThreadId.value) return "";
  return (
    threads.threads.find((thread) => thread.thread_id === routeThreadId.value)
      ?.values.title ?? ""
  );
});
const currentThread = computed(() => {
  const threadId = routeThreadId.value;
  if (!threadId) return null;
  const existing = threads.threads.find(
    (thread) => thread.thread_id === threadId,
  );
  if (existing) return existing;
  return {
    thread_id: threadId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {},
    status: "idle",
    values: { title: currentTitle.value, messages: visibleMessages.value },
    interrupts: {},
  } as AgentThread;
});
const isWelcomeMode = computed(
  () => visibleMessages.value.length === 0 && !stream.isHistoryLoading.value,
);

function toggleSidebar() {
  globalThis.dispatchEvent(new CustomEvent("deerflow:toggle-sidebar"));
}
function startAgentChat() {
  if (!props.agentName) return;
  void router.push(
    `/workspace/agents/${encodeURIComponent(props.agentName)}/chats/new`,
  );
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

function recentConversation(
  messages: readonly Message[] = visibleMessages.value,
) {
  return messages
    .filter((message) => message.type === "human" || message.type === "ai")
    .map((message) => ({
      role: message.type === "human" ? "user" : "assistant",
      content: messageText(message),
    }))
    .filter((message) => message.content.trim())
    .slice(-6);
}

async function refreshPostRun(
  targetThreadId: string | null,
  completedMessages: readonly Message[],
) {
  if (!targetThreadId) return;
  // The just-completed run is the authoritative suggestion input. Capture it
  // before metadata/token refreshes can re-read an eventually-consistent
  // thread snapshot and temporarily replace the visible history.
  const messages = recentConversation(completedMessages);
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
  const config =
    suggestionsConfigQuery.data.value ??
    (await suggestionsConfigQuery.refetch({ cancelRefetch: false })).data;
  if (
    controller.signal.aborted ||
    !suggestionGeneration.isCurrent(token, scope) ||
    !config?.enabled
  ) {
    return;
  }
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
      (routeThreadId.value ?? lastStartedThreadId) !== targetThreadId ||
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

watch(
  [routeThreadId, () => props.agentName],
  ([nextThreadId, nextAgentName], [previousThreadId, previousAgentName]) => {
    // `new` adopts the same thread id produced by onStart. That URL update is
    // not a conversation switch and must not abort the post-run suggestion
    // request already owned by that thread.
    const adoptingStartedThread =
      previousThreadId === null &&
      nextThreadId === lastStartedThreadId &&
      nextAgentName === previousAgentName;
    if (adoptingStartedThread) return;

    suggestionGeneration.invalidate();
    suggestionController?.abort();
    suggestionController = null;
    followupsLoading.value = false;
    followups.value = [];
  },
);

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
    bootstrapConversationReady.value = false;
    bootstrapConversationFinished.value = false;
    void send(
      $i18n.t.value.agents.nameStepBootstrapMessage.replace(
        "{name}",
        agentName,
      ),
      [],
    ).then((accepted) => {
      // Save may start only after the design conversation has fully released
      // the stream owner. Enabling it from onFinish is too early because
      // sendMessage still owns its single-flight guard until submit resolves.
      if (
        accepted &&
        bootstrapConversationFinished.value &&
        props.bootstrap &&
        props.agentName === agentName &&
        bootstrapAgentName === agentName
      ) {
        bootstrapConversationReady.value = true;
      }
    });
  },
  { immediate: true },
);
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
  /*
    只探 `GET /threads/{id}`：**它自己就带着 checkpoint 的 values**，再取一次
    `/state` 拿到的是同一份东西。

    这不是推断，是读后端加实测的结论。两个路由都走 `accessor.aget(config)` 取
    同一个最新快照，再用同一个 `serialize_channel_values_for_api` 序列化：
    `GET /{id}` 里的 `values=serialize_channel_values_for_api(snapshot.values)`
    与 `GET /{id}/state` 里的那一行逐字相同，连 accessor 都是同一个——
    `build_thread_checkpoint_state_accessor` 就是把 assistant_id 查出来再调
    `build_checkpoint_state_accessor`，而 `GET /{id}` 是把这两步内联了。
    实测（replay Gateway，写过一次 state 因而有 checkpoint 的线程）：两边的
    `values` 键集与 JSON 都完全相等。

    于是原先那句 `{ ...metadata.values, ...state.values }` 是拿一份值盖它自己，
    两条分支都是 no-op：
    - 有 checkpoint：两边同值，合并结果不变；
    - 没有 checkpoint（上下文压缩之后）：`/state` 404，`GET /{id}` 仍然 200
      并返回空快照的 values，合并结果同样不变。
    删掉之后每次打开线程少一次完全重复的往返。

    另外，`/state` 从来就没参与过「线程是否存在」的判断——那条判据在
    core/threads/thread-presence.ts 里，读的只有这一次元数据探测的错误码。
  */
  try {
    const metadata = await getAPIClient().threads.get(initialRouteThreadId);
    threads.upsert(metadata);
    threadPresence.value = {
      threadId: initialRouteThreadId,
      presence: "present",
    };
  } catch (error) {
    // 探测失败本身不构成「不存在」：只有 403/404 才是。其余错误留在 unknown，
    // 于是一次瞬时 5xx 不会把用户连人带对话踢回新会话。
    threadPresence.value = {
      threadId: initialRouteThreadId,
      presence: isThreadMissingError(error) ? "missing" : "unknown",
    };
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
    :panel-padded="activePanel === 'artifacts'"
    :panel-description="$i18n.t.value.workspace.sidePanelDescription"
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
          <!--
            名字与状态都照 React 的 SidebarTrigger（frontend/src/components/ui/sidebar.tsx）：
            一个 sr-only 的 "Toggle Sidebar"，**没有** aria-expanded / aria-controls。
            侧栏在移动端是一个会被卸载的抽屉，触发器指着一个此刻并不存在的 id，
            aria-controls 是断的；expanded 也只能描述抽屉，描述不了桌面端的收起态。
          -->
          <button
            v-if="!isDemo"
            type="button"
            data-sidebar="trigger"
            :aria-label="$i18n.t.value.primitives.toggleSidebar"
            class="hover:bg-accent flex size-8 items-center justify-center rounded-md md:hidden"
            @click="toggleSidebar"
          >
            <Menu :size="18" />
          </button>
          <div
            v-if="agentName"
            class="flex min-w-0 shrink-0 items-center gap-1.5 rounded-md border px-2 py-1"
          >
            <Bot :size="14" class="text-primary" />
            <span
              class="hidden max-w-24 truncate text-xs font-medium sm:inline sm:max-w-none"
            >
              {{ agent?.name ?? agentName }}
            </span>
          </div>
          <!--
            没有真实标题就**不渲染**任何文字，与 React 的 ThreadTitle 一致
            （frontend/src/components/workspace/thread-title.tsx 的
            `if (!thread.values?.title) return null`）。「新对话」只是标签页标题的
            兜底，不是这条会话的名字——把它画在头部，读屏器会把每一个空会话都念成
            一条叫「新对话」的记录。容器保留，占位由它负责。
          -->
          <div class="min-w-0 flex-1 truncate text-sm font-medium">
            {{ headerTitle }}
          </div>
          <button
            v-if="agentName && !bootstrap"
            type="button"
            :aria-label="$i18n.t.value.agents.newChat"
            class="bg-secondary text-secondary-foreground hover:bg-secondary/80 flex h-8 items-center gap-2 rounded-md px-2 text-xs sm:px-3"
            @click="startAgentChat"
          >
            <PlusSquare :size="16" />
            <span class="hidden sm:inline">{{
              $i18n.t.value.agents.newChat
            }}</span>
          </button>
          <!--
            outline / sm 的按钮外观加一段 `hidden sm:inline` 的文字，不是一颗纯图标的
            方按钮：React 的 ThreadScheduledTasksLink 就是
            `<Button variant="outline" size="sm" asChild>` 包一个带同名 span 的链接
            （frontend/src/components/workspace/thread-scheduled-tasks-link.tsx）。
            两边的可访问名都来自 aria-label，所以这处差异在可访问性树上看不见——
            看得见的是宽屏上一个念得出名字的按钮 vs 一个只有图标的方块。
          -->
          <NuxtLink
            v-if="routeThreadId && !agentName && !isDemo"
            :to="`/workspace/scheduled-tasks?thread_id=${encodeURIComponent(routeThreadId)}`"
            :aria-label="$i18n.t.value.sidebar.scheduledTasks"
            :class="buttonVariants({ variant: 'outline', size: 'sm' })"
          >
            <CalendarClock :size="16" />
            <span class="hidden sm:inline">{{
              $i18n.t.value.sidebar.scheduledTasks
            }}</span>
          </NuxtLink>
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
          <button
            v-if="bootstrap"
            type="button"
            data-testid="agent-save"
            class="rounded-md border px-3 py-1.5 text-xs"
            :disabled="
              !bootstrapConversationReady ||
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
          <BrowserTrigger
            v-if="browserEnabled"
            :open="activePanel === 'browser'"
            @toggle="toggleBrowser"
          />
          <ExportTrigger
            v-if="routeThreadId && currentThread && !isWelcomeMode && !isDemo"
            :thread-id="routeThreadId"
            :thread="currentThread"
            :messages="visibleMessages"
          />
          <ArtifactTrigger
            :count="artifactPanel.artifacts.value.length"
            @open="showArtifacts"
          />
        </header>
        <!--
          内层还有一个 main：React 的 SidebarInset 是外层 main，ChatPage 自己再开一个
          （frontend/src/components/workspace/chats/chat-page.tsx）。头部浮在上面、
          不属于对话本身，所以 main 从消息流开始——读屏器的「跳到主内容」应当落在对话，
          而不是落在标题栏。
        -->
        <main class="flex min-h-0 max-w-full grow flex-col">
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
            @browser="openBrowserFrame"
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
            <button
              type="button"
              class="ml-2 underline"
              @click="creation.retry"
            >
              {{ $i18n.t.value.agents.retry }}
            </button>
          </div>
          <div
            class="right-0 bottom-0 left-0 z-30 flex justify-center px-3 sm:px-4"
            :class="isWelcomeMode ? 'absolute' : 'relative shrink-0 pb-4'"
          >
            <!--
            欢迎态把输入框抬到视口中线：窄屏减 48px、sm 以上减 96px，与 React 的
            `-translate-y-[calc(50vh-48px)] sm:-translate-y-[calc(50vh-96px)]` 同一组
            数字。只写 96px 的话，窄屏上输入框会比 React 低 48px——两边看起来是同一个
            布局，量出来不是。
          -->
            <div
              class="relative w-full"
              :class="[
                isWelcomeMode
                  ? 'max-w-[var(--container-width-sm)] -translate-y-[calc(50vh-48px)] sm:-translate-y-[calc(50vh-96px)]'
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
              <!--
              欢迎语是**浮在**输入框上方的一层，不占布局：React 把它作为 extraHeader
              放进一对 absolute 容器里（frontend/src/components/workspace/input-box.tsx），
              外层贴住输入框顶边、内层用 bottom-0 把内容顶到边线之上。
              留在文档流里的话，问候语有多高，输入框就被往下推多少——同一块屏幕上
              两个应用的输入框会差出一行的位置，而这正是几何比对量到的那 24px。
            -->
              <div
                v-if="
                  isWelcomeMode &&
                  !(bootstrap && creation.status.value === 'created')
                "
                class="absolute top-0 right-0 left-0 z-10"
              >
                <!--
                  agent 会话页与普通聊天页的欢迎区是**两个不同的东西**，上游也是
                  两个组件（`AgentWelcome` vs `Welcome`）。同一个 AgentChat 服务两条
                  路由，所以这一支要显式分开；此前只有通用那一支，打开自定义 agent
                  的新会话时读到的是「👋 Hello, again!」而不是 agent 自己的名字。
                -->
                <AgentWelcome
                  v-if="agentName"
                  class="absolute right-0 bottom-0 left-0"
                  :agent="agent"
                  :agent-name="agentName"
                />
                <div
                  v-else
                  class="absolute right-0 bottom-0 left-0 mx-auto flex w-full flex-col items-center justify-center gap-2 px-4 py-4 text-center sm:px-8"
                >
                  <div
                    class="flex flex-wrap items-center justify-center gap-2 text-2xl font-bold"
                  >
                    <!--
                  这个 👋 **不能** aria-hidden：React 的 Welcome 把它当成正文
                  （frontend/src/components/workspace/welcome.tsx 里它只是一个普通
                  div），于是读屏器读到的是「👋 Hello, again!」。藏掉它，两边听到的
                  欢迎语就不是同一句。
                -->
                    <span>👋</span>
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
                :surface-class="
                  isWelcomeMode ? '-translate-y-2 sm:-translate-y-4' : ''
                "
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
        </main>
      </section>
    </template>
    <template #panel>
      <ArtifactOverview
        v-if="
          activePanel === 'artifacts' &&
          routeThreadId &&
          !artifactPanel.selectedArtifact.value
        "
        :thread-id="routeThreadId"
        :artifacts="artifactPanel.artifacts.value"
        :is-mock="isDemo"
        @close="artifactPanel.close()"
        @select="openArtifact($event)"
      />
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
