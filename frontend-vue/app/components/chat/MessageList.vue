<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import StreamMarkdown from "@/components/markdown/StreamMarkdown.vue";
import HumanInputCard from "@/components/chat/HumanInputCard.vue";
import { richContentComponents } from "@/components/markdown/components";
import { extractCitationSources } from "@/core/citations/sources";
import {
  deriveHumanInputThreadState,
  extractHumanInputRequest,
  type HumanInputRequest,
  type HumanInputResponse,
} from "@/core/messages/human-input";
import {
  extractContentFromMessage,
  extractReasoningContentFromMessage,
  getBranchableAssistantGroupIds,
  getLatestEditableTurn,
  getMessageGroups,
} from "@/core/messages/utils";
import { getSafeMarkdown } from "@/core/markdown/safe-markdown";
import {
  formatRunDuration,
  getRunDurationDisplaysByGroupIndex,
} from "@/core/messages/run-duration";
import {
  derivePendingSubtaskStatus,
  parseSubtaskResult,
} from "@/core/tasks/subtask-result";
import type { Message } from "@/core/types/message";

const props = defineProps<{
  messages: Message[];
  rawMessages?: Message[];
  streaming: boolean;
  loading: boolean;
}>();
const emit = defineEmits<{
  branch: [messageId: string, messageIds: string[]];
  regenerate: [messageId: string, messageIds: string[]];
  edit: [messageId: string, text: string, messageIds: string[]];
  humanInput: [request: HumanInputRequest, response: HumanInputResponse];
}>();
const pendingHumanInputs = ref(new Set<string>());

const normalizedMessages = computed(() =>
  props.messages.map((message) => {
    const wireType = (message as unknown as { type: string }).type;
    if (wireType === "AIMessageChunk") {
      return { ...message, type: "ai" } as Message;
    }
    if (wireType === "HumanMessageChunk") {
      return { ...message, type: "human" } as Message;
    }
    if (wireType === "ToolMessageChunk") {
      return { ...message, type: "tool" } as Message;
    }
    return message;
  }),
);
const groups = computed(() =>
  getMessageGroups(normalizedMessages.value, {
    isCurrentTurnLoading: props.streaming,
  }),
);
const branchable = computed(() =>
  getBranchableAssistantGroupIds(groups.value, props.streaming),
);
const editable = computed(() =>
  getLatestEditableTurn(groups.value, props.streaming),
);
const durations = computed(() =>
  getRunDurationDisplaysByGroupIndex(groups.value),
);
const humanInputState = computed(() =>
  deriveHumanInputThreadState(props.rawMessages ?? normalizedMessages.value),
);
const scroller = ref<HTMLElement | null>(null);
const windowStart = ref<number | null>(null);
const sideChatVisible = ref(false);
const VIRTUAL_WINDOW_SIZE = 50;
const ESTIMATED_GROUP_HEIGHT_PX = 80;

const renderedGroups = computed(() => {
  if (groups.value.length <= 80)
    return groups.value.map((group, index) => ({ group, index }));
  const maxStart = Math.max(0, groups.value.length - VIRTUAL_WINDOW_SIZE);
  const start = Math.min(windowStart.value ?? maxStart, maxStart);
  return groups.value
    .slice(start, start + VIRTUAL_WINDOW_SIZE)
    .map((group, offset) => ({ group, index: start + offset }));
});
const virtualTopHeight = computed(() =>
  groups.value.length > 80
    ? (renderedGroups.value[0]?.index ?? 0) * ESTIMATED_GROUP_HEIGHT_PX
    : 0,
);
const virtualBottomHeight = computed(() => {
  if (groups.value.length <= 80) return 0;
  const renderedEnd = (renderedGroups.value.at(-1)?.index ?? -1) + 1;
  return (
    Math.max(0, groups.value.length - renderedEnd) * ESTIMATED_GROUP_HEIGHT_PX
  );
});

function text(message: Message) {
  return extractContentFromMessage(message);
}
function reasoning(message: Message) {
  return extractReasoningContentFromMessage(message);
}
function citations(message: Message) {
  return extractCitationSources(text(message));
}
function subtaskResult(toolCallId: string | undefined) {
  const result = normalizedMessages.value.find(
    (message) => message.type === "tool" && message.tool_call_id === toolCallId,
  );
  if (!result) {
    return {
      status: derivePendingSubtaskStatus(
        toolCallId,
        normalizedMessages.value,
        props.streaming,
      ),
    };
  }
  return parseSubtaskResult(text(result), result.additional_kwargs);
}
async function submitHumanInput(
  request: HumanInputRequest,
  response: HumanInputResponse,
) {
  pendingHumanInputs.value = new Set([
    ...pendingHumanInputs.value,
    request.request_id,
  ]);
  emit("humanInput", request, response);
}
function groupIds(index: number) {
  const ids: string[] = [];
  for (let cursor = 0; cursor <= index; cursor += 1) {
    for (const message of groups.value[cursor]?.messages ?? []) {
      if (message.id) ids.push(message.id);
    }
  }
  return ids;
}
function lastAI(index: number) {
  return [...(groups.value[index]?.messages ?? [])]
    .reverse()
    .find((message) => message.type === "ai");
}
function onScroll() {
  if (!scroller.value || groups.value.length <= 80) return;
  const maxStart = Math.max(0, groups.value.length - VIRTUAL_WINDOW_SIZE);
  const scrollRange = scroller.value.scrollHeight - scroller.value.clientHeight;
  if (
    scrollRange <= 0 ||
    scroller.value.scrollTop + scroller.value.clientHeight >=
      scroller.value.scrollHeight - 1
  ) {
    windowStart.value = maxStart;
    return;
  }
  const ratio = scrollRange <= 0 ? 0 : scroller.value.scrollTop / scrollRange;
  windowStart.value = Math.round(maxStart * ratio);
}
function onSelection() {
  sideChatVisible.value = Boolean(
    globalThis.getSelection?.()?.toString().trim(),
  );
}
function onKey(event: KeyboardEvent) {
  if (event.key === "Escape") sideChatVisible.value = false;
}
function durationLabel(seconds: number) {
  return `Completed in ${formatRunDuration(seconds, {
    lessThanSecond: "less than a second",
    hours: (value) => `${value}h`,
    minutes: (value) => `${value}m`,
    seconds: (value) => `${value}s`,
    separator: " ",
  })}`;
}

watch(
  () => groups.value.length,
  async (nextLength, previousLength = 0) => {
    const previousMaxStart = Math.max(0, previousLength - VIRTUAL_WINDOW_SIZE);
    const wasFollowingTail =
      windowStart.value === null || windowStart.value >= previousMaxStart - 1;

    if (nextLength <= 80) {
      windowStart.value = null;
    } else if (wasFollowingTail) {
      windowStart.value = Math.max(0, nextLength - VIRTUAL_WINDOW_SIZE);
    }

    if (!wasFollowingTail) return;
    await nextTick();
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
  },
  { immediate: true },
);
watch(humanInputState, (state) => {
  if (pendingHumanInputs.value.size === 0) return;
  pendingHumanInputs.value = new Set(
    [...pendingHumanInputs.value].filter(
      (requestId) => !state.answeredResponses.has(requestId),
    ),
  );
});
onMounted(() => {
  globalThis.addEventListener("keydown", onKey);
  nextTick(() => {
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
  });
});
onUnmounted(() => globalThis.removeEventListener("keydown", onKey));
</script>

<template>
  <div role="log" aria-label="Conversation" class="min-h-0 flex-1">
    <div
      ref="scroller"
      class="h-full overflow-y-auto px-6 py-5"
      @scroll="onScroll"
    >
      <div v-if="loading" class="py-8 text-center text-sm text-gray-500">
        Loading conversation…
      </div>
      <div class="mx-auto max-w-3xl space-y-5">
        <div
          v-if="virtualTopHeight"
          aria-hidden="true"
          :style="{ height: `${virtualTopHeight}px` }"
        />
        <article
          v-for="entry in renderedGroups"
          :key="entry.group.id ?? entry.index"
          :data-index="entry.index"
          :data-assistant-turn="
            entry.group.type === 'assistant' ? '' : undefined
          "
          :class="
            entry.group.type === 'human'
              ? 'is-user bg-secondary ml-auto max-w-[85%] rounded-2xl px-4 py-3 whitespace-pre-wrap'
              : 'group relative'
          "
          @mouseup="onSelection"
        >
          <template v-for="message in entry.group.messages" :key="message.id">
            <HumanInputCard
              v-if="extractHumanInputRequest(message)"
              :request="extractHumanInputRequest(message)!"
              :answered="
                humanInputState.answeredResponses.get(
                  extractHumanInputRequest(message)!.request_id,
                )
              "
              :active="
                humanInputState.latestOpenRequestId ===
                extractHumanInputRequest(message)!.request_id
              "
              :pending="
                pendingHumanInputs.has(
                  extractHumanInputRequest(message)!.request_id,
                )
              "
              @submit="
                submitHumanInput(extractHumanInputRequest(message)!, $event)
              "
            />
            <template v-if="message.type === 'human'">
              <p>{{ text(message) }}</p>
              <button
                v-if="editable?.humanMessage.id === message.id"
                type="button"
                class="mt-2 text-xs opacity-0 group-hover:opacity-100 hover:underline"
                aria-label="Edit and rerun"
                @click="
                  emit(
                    'edit',
                    message.id ?? '',
                    text(message),
                    groupIds(entry.index),
                  )
                "
              >
                Edit and rerun
              </button>
            </template>
            <template v-else-if="message.type === 'ai'">
              <details v-if="reasoning(message)" class="mb-3" open>
                <summary
                  role="button"
                  class="cursor-pointer text-sm font-medium"
                >
                  {{
                    streaming && entry.index === groups.length - 1
                      ? "Thinking"
                      : "Reasoning"
                  }}
                </summary>
                <p class="mt-2 text-sm text-gray-500">
                  {{ reasoning(message) }}
                </p>
              </details>
              <StreamMarkdown
                v-if="text(message)"
                :content="getSafeMarkdown(text(message))"
                :components="richContentComponents"
                :parse-incomplete-markdown="streaming"
              />
              <div
                v-if="citations(message).length"
                class="mt-3 flex flex-wrap gap-2"
                aria-label="Sources"
              >
                <a
                  v-for="source in citations(message)"
                  :key="source.id"
                  :href="source.url"
                  target="_blank"
                  rel="noreferrer"
                  class="rounded-full border px-2 py-1 text-xs"
                >
                  {{ source.title }}
                </a>
              </div>
              <div
                v-for="call in message.tool_calls ?? []"
                :key="call.id"
                class="my-2 rounded-lg border p-3 text-sm"
              >
                <template v-if="call.name === 'task'">
                  <p>{{ String(call.args?.description ?? "Subtask") }}</p>
                  <p
                    :class="
                      subtaskResult(call.id).status === 'failed'
                        ? 'text-red-600'
                        : 'text-gray-500'
                    "
                  >
                    {{
                      subtaskResult(call.id).status === "completed"
                        ? "Subtask completed"
                        : subtaskResult(call.id).status === "failed"
                          ? "Subtask failed"
                          : "Running subtask"
                    }}
                  </p>
                  <p v-if="subtaskResult(call.id).result" class="mt-1 text-sm">
                    {{ subtaskResult(call.id).result }}
                  </p>
                  <p
                    v-if="subtaskResult(call.id).error"
                    class="mt-1 text-sm text-red-600"
                  >
                    {{ subtaskResult(call.id).error }}
                  </p>
                </template>
                <template v-else>
                  <p class="font-medium">{{ call.name }}</p>
                  <pre
                    v-if="call.args && Object.keys(call.args).length"
                    class="mt-1 overflow-x-auto text-xs whitespace-pre-wrap text-gray-500"
                    >{{ JSON.stringify(call.args, null, 2) }}</pre>
                </template>
              </div>
            </template>
            <details
              v-else-if="message.type === 'tool'"
              class="my-2 rounded-lg border p-3 text-sm"
            >
              <summary class="cursor-pointer font-medium">
                {{ message.name ?? "Tool result" }}
              </summary>
              <pre class="mt-2 overflow-x-auto text-xs whitespace-pre-wrap">{{
                text(message)
              }}</pre>
            </details>
          </template>

          <div
            v-if="entry.group.type === 'assistant'"
            class="mt-2 flex gap-3 text-xs opacity-0 group-hover:opacity-100"
          >
            <button
              v-if="branchable.has(entry.group.id ?? '')"
              type="button"
              aria-label="Branch conversation"
              @click="
                emit('branch', entry.group.id ?? '', groupIds(entry.index))
              "
            >
              Branch conversation
            </button>
            <button
              v-if="
                entry.index === groups.length - 1 && lastAI(entry.index)?.id
              "
              type="button"
              aria-label="Regenerate"
              @click="
                emit(
                  'regenerate',
                  lastAI(entry.index)?.id ?? '',
                  entry.group.messages.flatMap((message) =>
                    message.id ? [message.id] : [],
                  ),
                )
              "
            >
              Regenerate
            </button>
          </div>
          <p
            v-for="duration in durations[entry.index] ?? []"
            :key="duration.runId"
            data-testid="run-duration"
            class="mt-2 text-xs text-gray-500"
          >
            {{ durationLabel(duration.durationSeconds) }}
          </p>
        </article>
        <div
          v-if="virtualBottomHeight"
          aria-hidden="true"
          :style="{ height: `${virtualBottomHeight}px` }"
        />
      </div>
    </div>
    <button
      v-if="sideChatVisible"
      type="button"
      class="bg-background fixed right-8 bottom-28 z-40 rounded-md border px-3 py-2 shadow"
      aria-label="Ask in side chat"
    >
      Ask in side chat
    </button>
  </div>
</template>
