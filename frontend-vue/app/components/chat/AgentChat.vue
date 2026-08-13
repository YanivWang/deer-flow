<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

import ChatComposer from "@/components/chat/ChatComposer.vue";
import MessageList from "@/components/chat/MessageList.vue";
import { useThreadStream } from "@/composables/useThreadStream";
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
import { getBaseSettingsSnapshot } from "@/core/settings/store";
import {
  DEFAULT_MAX_SUGGESTIONS,
  loadSuggestionsConfig,
} from "@/core/suggestions/api";
import type { Message } from "@/core/types/message";
import { useThreadsStore } from "@/stores/threads";

const props = defineProps<{
  agentName?: string | null;
}>();
const route = useRoute();
const router = useRouter();
const threads = useThreadsStore();

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
const context = computed(() => ({
  ...getBaseSettingsSnapshot().context,
  ...(props.agentName ? { agent_name: props.agentName } : {}),
}));
const warnings = ref<string[]>([]);
const localUploading = ref(false);
const demoMessages = ref<Message[] | null>(null);
const followups = ref<string[]>([]);
const followupsLoading = ref(false);
const suggestionsEnabled = ref(false);
const maxSuggestions = ref(DEFAULT_MAX_SUGGESTIONS);
const composer = ref<InstanceType<typeof ChatComposer> | null>(null);
const failedSend = ref<{ text: string; files: FileInMessage[] } | null>(null);
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
    warn: (message) => warnings.value.push(message),
    error: (message) => warnings.value.push(message),
  },
  onStart(startedThreadId) {
    threads.upsertCreated(startedThreadId, props.agentName);
    if (routeThreadId.value === null) {
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
  },
});

const visibleMessages = computed(() =>
  (demoMessages.value ?? stream.messages.value).filter(
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
  try {
    const targetThreadId = await ensureThread();
    await stream.sendMessage(targetThreadId, { text, files });
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
    await getAPIClient().threads.get(initialRouteThreadId);
  } catch {
    await router.replace("/workspace/chats/new");
  }
});
onUnmounted(() =>
  globalThis.removeEventListener("deerflow:new-chat", resetNewChat),
);
</script>

<template>
  <section id="chat" class="flex h-full min-h-0 flex-col">
    <header class="border-border flex items-center border-b px-6 py-3">
      <h1 class="truncate text-sm font-semibold">{{ currentTitle }}</h1>
    </header>
    <MessageList
      :messages="visibleMessages"
      :raw-messages="demoMessages ?? stream.messages.value"
      :streaming="stream.isStreaming.value"
      :loading="stream.isHistoryLoading.value"
      @branch="branch"
      @regenerate="regenerate"
      @edit="beginEdit"
      @human-input="respondHumanInput"
    />
    <div
      v-if="editState"
      class="border-border mx-auto w-full max-w-3xl border-t p-3"
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
      class="px-6 py-1 text-sm text-amber-600"
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
      v-if="followupsLoading || followups.length"
      data-slot="suggestions-list"
      class="mx-auto flex w-full max-w-3xl flex-wrap justify-center gap-2 px-5 pb-2"
    >
      <span v-if="followupsLoading" class="text-xs text-gray-500">
        Generating follow-up questions...
      </span>
      <button
        v-for="suggestion in followups"
        :key="suggestion"
        type="button"
        class="rounded-full border px-3 py-1.5 text-xs"
        @click="composer?.replaceDraft(suggestion)"
      >
        {{ suggestion }}
      </button>
      <button
        v-if="followups.length"
        type="button"
        aria-label="Close"
        class="rounded-full border px-2 py-1.5 text-xs"
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
      :prompt-history="promptHistory"
      :ensure-thread="ensureThread"
      @send="send"
      @stop="stream.stop()"
      @uploading-change="
        localUploading = $event;
        stream.isUploading.value = $event;
      "
    />
  </section>
</template>
