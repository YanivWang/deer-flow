<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { CalendarClock, Menu, Share2 } from "lucide-vue-next";

import ChatComposer from "@/components/chat/ChatComposer.vue";
import MessageList from "@/components/chat/MessageList.vue";
import AuroraText from "@/components/ui/effects/AuroraText.vue";
import ContextUsageBadge from "@/components/workspace/ContextUsageBadge.vue";
import WorkspacePanels from "@/components/workspace/WorkspacePanels.vue";
import ArtifactPanel from "@/components/workspace/artifacts/ArtifactPanel.vue";
import ArtifactTrigger from "@/components/workspace/artifacts/ArtifactTrigger.vue";
import BrowserPanel from "@/components/workspace/browser-view/BrowserPanel.vue";
import BrowserTrigger from "@/components/workspace/browser-view/BrowserTrigger.vue";
import SidecarPanel from "@/components/workspace/sidecar/SidecarPanel.vue";
import { useArtifactsPanel } from "@/composables/useArtifactsPanel";
import { useSidecar } from "@/composables/useSidecar";
import { useThreadStream } from "@/composables/useThreadStream";
import { useNotifications } from "@/composables/useNotifications";
import { useWorkspaceFeatures } from "@/composables/useWorkspaceFeatures";
import {
  branchThreadFromTurn,
  fetchThreadTokenUsage,
} from "@/core/threads/api";
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
import { getBaseSettingsSnapshot } from "@/core/settings/store";
import {
  DEFAULT_MAX_SUGGESTIONS,
  loadSuggestionsConfig,
} from "@/core/suggestions/api";
import type { Message, ToolCall } from "@/core/types/message";
import {
  retainThreadTokenUsagePlaceholder,
  selectContextUsage,
} from "@/core/threads/token-usage";
import type { GoalState, ThreadTokenUsageResponse } from "@/core/threads/types";
import {
  buildReferenceMessageMetadata,
  type SidecarContext,
} from "@/core/sidecar";
import { buildWriteFileArtifactURL } from "@/core/artifacts/utils";
import { useThreadsStore } from "@/stores/threads";

const props = defineProps<{
  agentName?: string | null;
  bootstrap?: boolean;
}>();
const { $i18n } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const threads = useThreadsStore();
const features = useWorkspaceFeatures();
const notifications = useNotifications();

const routeThreadId = computed(() => {
  const raw = route.params.thread_id;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "new" || !value ? null : value;
});
const initialRouteThreadId = routeThreadId.value;
const draftThreadId = ref(globalThis.crypto.randomUUID());
watch(routeThreadId, (id) => {
  if (id === null) draftThreadId.value = globalThis.crypto.randomUUID();
});
const contextOverrides = ref<Record<string, unknown>>({});
const context = computed(() => ({
  ...getBaseSettingsSnapshot().context,
  ...contextOverrides.value,
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
const followups = ref<string[]>([]);
const followupsLoading = ref(false);
const suggestionsEnabled = ref(false);
const maxSuggestions = ref(DEFAULT_MAX_SUGGESTIONS);
const composer = ref<InstanceType<typeof ChatComposer> | null>(null);
const failedSend = ref<{ text: string; files: FileInMessage[] } | null>(null);
const mainTailRequest = ref(0);
const mobileSidebarOpen = ref(false);
const threadTokenUsage = ref<ThreadTokenUsageResponse | null>();
const contextUsage = computed(() => selectContextUsage(threadTokenUsage.value));
let tokenUsageRequest = 0;
const preparedThreadId = ref<string | null>(null);
const editState = ref<{
  messageId: string;
  text: string;
  messageIds: string[];
} | null>(null);

const stream = useThreadStream({
  threadId: routeThreadId,
  context,
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
    threads.upsertCreated(startedThreadId, props.agentName);
    if (routeThreadId.value === null && !props.bootstrap) {
      const path = props.agentName
        ? `/workspace/agents/${encodeURIComponent(props.agentName)}/chats/${startedThreadId}`
        : `/workspace/chats/${startedThreadId}`;
      void router.replace(path);
    }
  },
  onFinish(state) {
    const id = routeThreadId.value;
    const title = Reflect.get(state, "title");
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
      if (!lastAssistant && remainingAttempts > 0) {
        completionNotificationTimer = setTimeout(
          () => notifyWhenFinalMessageIsVisible(remainingAttempts - 1),
          25,
        );
        return;
      }
      notifications.showNotification(currentTitle.value, {
        body: lastAssistant ? messageText(lastAssistant) : undefined,
      });
    };
    completionNotificationTimer = setTimeout(
      () => notifyWhenFinalMessageIsVisible(8),
      0,
    );
  },
});
const authoritativeArtifacts = computed(() => {
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
const sidecar = useSidecar({ parentThreadId: routeThreadId, context });
const sidecarReady = ref(false);
const browserOpen = ref(false);
watch(
  () => sidecar.sidecarThreadId.value,
  () => {
    sidecarReady.value = false;
  },
);
const activePanel = computed<"artifacts" | "sidecar" | "browser" | null>(() => {
  if (browserOpen.value) return "browser";
  if (sidecar.open.value) return "sidecar";
  if (artifactPanel.open.value && artifactPanel.selectedArtifact.value)
    return "artifacts";
  return null;
});
const panelOpen = computed(() => activePanel.value !== null);

function openArtifact(path: string) {
  browserOpen.value = false;
  sidecar.close();
  artifactPanel.select(path);
}
async function toggleSidecar() {
  if (sidecar.open.value) {
    sidecar.close();
    return;
  }
  const restored = await sidecar.restoreSidecarThread({ force: true });
  if (restored) {
    browserOpen.value = false;
    artifactPanel.close();
    sidecar.open.value = true;
  }
}
function openBrowser() {
  artifactPanel.close();
  sidecar.close();
  browserOpen.value = true;
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
  artifactPanel.close();
  sidecar.openContext(next);
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

let artifactOpenTimer: ReturnType<typeof setTimeout> | undefined;
let completionNotificationTimer: ReturnType<typeof setTimeout> | undefined;
const scheduledArtifact = ref<string | null>(null);
function normalizeRenderableMessage(message: Message): Message {
  const wireType = (message as unknown as { type: string }).type;
  if (wireType === "AIMessageChunk")
    return { ...message, type: "ai" } as Message;
  if (wireType === "HumanMessageChunk")
    return { ...message, type: "human" } as Message;
  if (wireType === "ToolMessageChunk")
    return { ...message, type: "tool" } as Message;
  return message;
}
const renderableStreamMessages = computed(() =>
  stream.messages.value.map(normalizeRenderableMessage),
);
watch(
  renderableStreamMessages,
  (messages) => {
    let target: string | null = null;
    for (const message of messages) {
      const wireMessage = message as unknown as {
        type: string;
        tool_calls?: ToolCall[];
      };
      const wireType = wireMessage.type;
      if (wireType !== "ai" && wireType !== "AIMessageChunk") continue;
      for (const call of wireMessage.tool_calls ?? []) {
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
        if (
          call.name === "finalize_artifact_write" &&
          typeof path === "string"
        ) {
          const result = messages.find(
            (candidate) =>
              candidate.type === "tool" && candidate.tool_call_id === call.id,
          );
          if (result && messageText(result).trim() === "OK") target = path;
        }
      }
    }
    if (!target || target === scheduledArtifact.value) return;
    scheduledArtifact.value = target;
    clearTimeout(artifactOpenTimer);
    artifactOpenTimer = setTimeout(() => openArtifact(target!), 120);
  },
  { deep: true, immediate: true },
);

const visibleMessages = computed(() =>
  (demoMessages.value ?? renderableStreamMessages.value).filter(
    (message: Message) => !isHiddenFromUIMessage(message),
  ),
);
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
  if (!routeThreadId.value) return "New Chat";
  return (
    threads.threads.find((thread) => thread.thread_id === routeThreadId.value)
      ?.values.title ?? "New Chat"
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
    warnings.value.push("Conversation link copied.");
  } catch {
    warnings.value.push("Unable to copy the conversation link.");
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
  try {
    threads.upsert(await getAPIClient().threads.get(targetThreadId));
  } catch {
    // The stream state remains authoritative while metadata persistence catches up.
  }
  await refreshThreadTokenUsage(targetThreadId);
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
      },
    );
    if (!response.ok) return;
    const body = (await response.json()) as { suggestions?: unknown[] };
    followups.value = (body.suggestions ?? [])
      .flatMap((value) =>
        typeof value === "string" && value.trim() ? [value.trim()] : [],
      )
      .slice(0, maxSuggestions.value);
  } catch {
    followups.value = [];
  } finally {
    followupsLoading.value = false;
  }
}

async function refreshThreadTokenUsage(targetThreadId: string | null) {
  const request = ++tokenUsageRequest;
  if (!targetThreadId) {
    threadTokenUsage.value = undefined;
    return;
  }

  const retained = retainThreadTokenUsagePlaceholder(
    threadTokenUsage.value,
    targetThreadId,
  );
  threadTokenUsage.value = retained;
  try {
    const next = await fetchThreadTokenUsage(targetThreadId);
    if (request !== tokenUsageRequest || routeThreadId.value !== targetThreadId)
      return;
    threadTokenUsage.value = retainThreadTokenUsagePlaceholder(
      next,
      targetThreadId,
    );
  } catch {
    // A same-thread refresh may retain its last value; another route never can.
  }
}

watch(
  routeThreadId,
  (threadId) => {
    void refreshThreadTokenUsage(threadId);
  },
  { immediate: true },
);

async function ensureThread() {
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

async function send(text: string, files: FileInMessage[]) {
  followups.value = [];
  mainTailRequest.value += 1;
  try {
    const targetThreadId = await ensureThread();
    const quotes = [...sidecar.conversationQuotes.value];
    const contexts = quotes.map((quote) => quote.context);
    await stream.sendMessage(targetThreadId, { text, files }, undefined, {
      ...(contexts.length
        ? {
            additionalInputMessages: [quotePrompt(contexts)],
            additionalKwargs: buildReferenceMessageMetadata(contexts),
          }
        : {}),
      onSent: () => {
        if (quotes.length) sidecar.clearConversationQuotes();
      },
    });
    failedSend.value = null;
  } catch (error) {
    failedSend.value = { text, files };
    composer.value?.replaceDraft(text);
    warnings.value.push(
      error instanceof Error ? error.message : "Request failed.",
    );
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
  const targetThreadId = routeThreadId.value;
  if (!targetThreadId) return;
  await stream.sendMessage(
    targetThreadId,
    { text: buildHumanInputResponseText(request, response) },
    undefined,
    {
      additionalKwargs: {
        hide_from_ui: true,
        human_input_response: response,
      },
    },
  );
}
async function branch(messageId: string, messageIds: string[]) {
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
      title: original?.values.title ?? "Untitled",
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
  if (routeThreadId.value) {
    await stream.regenerateMessage(routeThreadId.value, messageId, messageIds);
  }
}
function beginEdit(messageId: string, text: string, messageIds: string[]) {
  editState.value = { messageId, text, messageIds };
}
async function updateAndRerun() {
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
  stream.resetView();
  preparedThreadId.value = null;
  draftThreadId.value = globalThis.crypto.randomUUID();
}
onMounted(() => globalThis.addEventListener("deerflow:new-chat", resetNewChat));
onMounted(() =>
  globalThis.addEventListener("deerflow:sidebar-state", updateSidebarState),
);
onMounted(() => {
  if (!props.bootstrap || !props.agentName) return;
  void send(
    $i18n.t.value.agents.nameStepBootstrapMessage.replace(
      "{name}",
      props.agentName,
    ),
    [],
  );
});
onMounted(async () => {
  try {
    const config = await loadSuggestionsConfig();
    suggestionsEnabled.value = config.enabled;
    maxSuggestions.value = config.max_suggestions;
  } catch {
    suggestionsEnabled.value = false;
  }
});
onMounted(async () => {
  if (route.query.mock !== "true" || !routeThreadId.value) return;
  try {
    const response = await globalThis.fetch(
      `/demo/threads/${encodeURIComponent(routeThreadId.value)}/thread.json`,
    );
    if (!response.ok) return;
    const fixture = (await response.json()) as {
      values?: { messages?: Message[] };
    };
    demoMessages.value = fixture.values?.messages ?? [];
  } catch {
    demoMessages.value = null;
  }
});
onMounted(async () => {
  if (!initialRouteThreadId) return;
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
onUnmounted(() =>
  globalThis.removeEventListener("deerflow:new-chat", resetNewChat),
);
onUnmounted(() =>
  globalThis.removeEventListener("deerflow:sidebar-state", updateSidebarState),
);
onUnmounted(() => {
  clearTimeout(artifactOpenTimer);
  clearTimeout(completionNotificationTimer);
});
</script>

<template>
  <WorkspacePanels
    :open="panelOpen"
    :animate="true"
    :panel-size="artifactPanel.panelSize.value"
    :panel-label="
      activePanel === 'artifacts'
        ? 'Artifacts'
        : activePanel === 'sidecar'
          ? 'Side chat'
          : 'Browser'
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
            type="button"
            data-sidebar="trigger"
            aria-label="Toggle sidebar"
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
          <ContextUsageBadge :context-usage="contextUsage" />
          <span
            v-if="agentName"
            class="bg-secondary text-secondary-foreground rounded-full px-2.5 py-1 text-xs"
            >{{ agentName }}</span
          >
          <button
            v-if="bootstrap"
            type="button"
            class="rounded-md border px-3 py-1.5 text-xs"
            :disabled="stream.isStreaming.value"
            @click="send($i18n.t.value.agents.saveCommandMessage, [])"
          >
            {{
              stream.isStreaming.value
                ? $i18n.t.value.agents.saving
                : $i18n.t.value.agents.save
            }}
          </button>
          <ArtifactTrigger
            :count="artifactPanel.artifacts.value.length"
            @open="
              browserOpen = false;
              sidecar.close();
              artifactPanel.setOpen(true);
              if (!artifactPanel.selectedArtifact.value) {
                artifactPanel.select(artifactPanel.artifacts.value[0]!);
              }
            "
          />
          <BrowserTrigger
            v-if="routeThreadId && features.browserControlEnabled.value"
            @open="openBrowser"
          />
          <NuxtLink
            v-if="routeThreadId"
            :to="`/workspace/scheduled-tasks?thread_id=${encodeURIComponent(routeThreadId)}`"
            aria-label="Scheduled tasks"
            class="text-muted-foreground hover:bg-accent flex size-8 items-center justify-center rounded-md"
          >
            <CalendarClock :size="16" />
          </NuxtLink>
          <button
            v-if="sidecar.sidecarThreadId.value && sidecarReady"
            type="button"
            data-testid="sidecar-header-trigger"
            :aria-label="
              sidecar.open.value ? 'Close side chat' : 'Open side chat'
            "
            class="text-muted-foreground hover:bg-accent flex size-8 items-center justify-center rounded-md"
            @click="toggleSidecar"
          >
            ◫
          </button>
          <button
            v-if="!isWelcomeMode"
            type="button"
            aria-label="Share conversation"
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
          :tail-request="mainTailRequest"
          selection-mode="main"
          test-id="main-message-list"
          @artifact="openArtifact"
          @selection-ask="askInSidecar"
          @selection-add="addToConversation"
          @branch="branch"
          @regenerate="regenerate"
          @edit="beginEdit"
          @human-input="respondHumanInput"
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
              Cancel
            </button>
            <button
              type="button"
              class="bg-primary text-primary-foreground rounded px-3 py-1"
              @click="updateAndRerun"
            >
              Update and rerun
            </button>
          </div>
        </div>
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
            Try again
          </button>
        </p>
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
            <div
              v-if="isWelcomeMode"
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
              v-if="isWelcomeMode || followupsLoading || followups.length"
              data-slot="suggestions-list"
              class="mb-2 flex w-full flex-wrap justify-center gap-2"
            >
              <span
                v-if="followupsLoading"
                class="text-muted-foreground bg-background/80 rounded-full border px-4 py-1.5 text-xs backdrop-blur-sm"
              >
                Generating follow-up questions...
              </span>
              <button
                v-for="suggestion in followups"
                :key="suggestion"
                type="button"
                class="text-muted-foreground bg-background hover:bg-accent rounded-full border px-3 py-1.5 text-xs"
                @click="composer?.replaceDraft(suggestion)"
              >
                {{ suggestion }}
              </button>
              <template
                v-if="
                  isWelcomeMode && !followupsLoading && followups.length === 0
                "
              >
                <button
                  v-for="suggestion in [
                    'Explore a topic',
                    'Create a presentation',
                    'Analyze data',
                  ]"
                  :key="suggestion"
                  type="button"
                  class="text-muted-foreground bg-background hover:bg-accent rounded-full border px-3 py-1.5 text-xs"
                  @click="composer?.replaceDraft(suggestion)"
                >
                  {{ suggestion }}
                </button>
              </template>
              <button
                v-if="followups.length"
                type="button"
                aria-label="Close"
                class="text-muted-foreground bg-background hover:bg-accent rounded-full border px-2.5 py-1.5 text-xs"
                @click="followups = []"
              >
                ×
              </button>
            </div>
            <ChatComposer
              ref="composer"
              :thread-key="routeThreadId ?? 'new'"
              :target-thread-id="routeThreadId ?? draftThreadId"
              :agent-name="agentName"
              :streaming="stream.isStreaming.value"
              :uploading="localUploading"
              :is-welcome="isWelcomeMode"
              :prompt-history="promptHistory"
              :ensure-thread="ensureThread"
              :references="sidecar.conversationQuotes.value"
              :context="context"
              :goal="activeGoal"
              @send="send"
              @stop="stream.stop()"
              @uploading-change="
                localUploading = $event;
                stream.isUploading.value = $event;
              "
              @clear-references="sidecar.clearConversationQuotes()"
              @context-change="contextOverrides = $event"
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
        :messages="renderableStreamMessages"
        :streaming="stream.isStreaming.value"
        @close="artifactPanel.close()"
        @select="artifactPanel.select($event)"
      />
      <SidecarPanel
        v-else-if="
          routeThreadId &&
          (activePanel === 'sidecar' ||
            (activePanel === null && sidecar.sidecarThreadId.value))
        "
        v-show="activePanel === 'sidecar'"
        :parent-thread-id="routeThreadId"
        :parent-messages="renderableStreamMessages"
        :sidecar-thread-id="sidecar.sidecarThreadId.value"
        :references="sidecar.activeReferences.value"
        :context="sidecar.context"
        :active="activePanel === 'sidecar'"
        @update:sidecar-thread-id="sidecar.sidecarThreadId.value = $event"
        @update:context="sidecar.setContext($event)"
        @clear-references="sidecar.clearActiveReferences()"
        @add-reference="sidecar.openContext($event)"
        @close="sidecar.close()"
        @deleted="sidecar.clearThreadAndClose()"
        @ready="sidecarReady = true"
      />
      <BrowserPanel
        v-else-if="routeThreadId && activePanel === 'browser'"
        :thread-id="routeThreadId"
        :active="activePanel === 'browser'"
        @close="browserOpen = false"
      />
    </template>
  </WorkspacePanels>
</template>
