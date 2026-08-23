<script setup lang="ts">
/*
  【文件职责】     DeerFlow 消息分组、reasoning/tool/human-input 渲染与消息操作编排。
  【对应 frontend/】 src/components/workspace/messages/message-list.tsx
  【架构位置】     L3 UI adapter
  【主要导出】     默认 MessageList 组件
  【依赖关系】     core/messages · markdown L2 · artifacts/changes/sidecar 扩展消费者
  【边界与注意】   B 组行为稳定，但直接依赖宿主 Message 与业务卡片，不能伪装成独立 L2 包。
*/
import {
  computed,
  defineAsyncComponent,
  defineComponent,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
  type ComponentPublicInstance,
} from "vue";
import {
  Check,
  CheckCircle2,
  Copy,
  GitBranch,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Wrench,
} from "lucide-vue-next";
import { useMutation, useQueryClient } from "@tanstack/vue-query";

import HumanInputCard from "@/components/chat/HumanInputCard.vue";
import CitationSourcesPanel from "@/components/chat/CitationSourcesPanel.vue";
import MessageAttachments from "@/components/chat/MessageAttachments.vue";
import MessageTokenUsage from "@/components/chat/MessageTokenUsage.vue";
import MarkdownLink from "@/components/chat/MarkdownLink.vue";
import SubtaskCard from "@/components/chat/SubtaskCard.vue";
import { MARKDOWN_LINK_CONTEXT } from "@/components/chat/markdown-link-context";
import WorkspaceChangesBadge from "@/components/workspace/changes/WorkspaceChangesBadge.vue";
import ReferenceAttachment from "@/components/workspace/sidecar/ReferenceAttachment.vue";
import { richContentComponents } from "@/components/markdown/components";
import {
  buildWriteFileArtifactURL,
  resolveMessageImageURL,
} from "@/core/artifacts/utils";
import { extractCitationSources } from "@/core/citations/sources";
import {
  deriveHumanInputThreadState,
  extractHumanInputRequest,
  shouldClearPendingHumanInputOnThreadError,
  type HumanInputRequest,
  type HumanInputResponse,
} from "@/core/messages/human-input";
import { deriveAssistantTurnUsageState } from "@/core/messages/derived-state";
import {
  extractContentFromMessage,
  extractReasoningContentFromMessage,
  getBranchableAssistantGroupIds,
  getLatestEditableTurn,
  getAssistantTurnCopyData,
  getMessageCopyData,
  getMessageGroups,
  stripUploadedFilesTag,
} from "@/core/messages/utils";
import { getSafeMarkdown } from "@/core/markdown/safe-markdown";
import {
  formatRunDuration,
  getRunDurationDisplaysByGroupIndex,
} from "@/core/messages/run-duration";
import {
  derivePendingSubtaskStatus,
  parseSubtaskResult,
  type SubtaskResultUpdate,
} from "@/core/tasks/subtask-result";
import type { Subtask } from "@/core/tasks/types";
import type { Message } from "@/core/types/message";
import { readReferenceMessageContexts } from "@/core/sidecar";
import {
  deleteFeedback,
  upsertFeedback,
  type FeedbackData,
} from "@/core/api/feedback";
import { writeTextToClipboard } from "@/core/clipboard";
import { threadHistoryQueryKey } from "@/core/threads/history";

const StreamMarkdown = defineAsyncComponent(
  () => import("@/components/markdown/StreamMarkdown.vue"),
);

const props = withDefaults(
  defineProps<{
    messages: Message[];
    rawMessages?: Message[];
    streaming: boolean;
    loading: boolean;
    threadId?: string | null;
    selectionMode?: "main" | "sidecar";
    testId?: string;
    active?: boolean;
    tailRequest?: number;
    resizeScroll?: "smooth" | "instant";
    interactive?: boolean;
    artifactPaths?: readonly string[];
    isMock?: boolean;
    subtasks?: Record<string, Subtask>;
    activeRunId?: string | null;
    hasMoreHistory?: boolean;
    historyLoadingMore?: boolean;
    historyError?: unknown;
    threadError?: unknown;
    submitHumanInput?: (
      request: HumanInputRequest,
      response: HumanInputResponse,
    ) => boolean | undefined | Promise<boolean | undefined>;
    tokenUsageInlineMode?: "off" | "per_turn" | "step_debug";
  }>(),
  {
    active: true,
    resizeScroll: "smooth",
  },
);
const emit = defineEmits<{
  branch: [messageId: string, messageIds: string[]];
  regenerate: [messageId: string, messageIds: string[]];
  edit: [messageId: string, text: string, messageIds: string[]];
  humanInput: [request: HumanInputRequest, response: HumanInputResponse];
  artifact: [path: string];
  selectionAsk: [payload: SelectionPayload];
  selectionAdd: [payload: SelectionPayload];
  loadMoreHistory: [];
}>();
const { $i18n } = useNuxtApp();
type SelectionPayload = {
  message: Message;
  selectedText: string;
  displayIndex: number;
};
const pendingHumanInputs = ref(new Set<string>());
const queryClient = useQueryClient();
const feedbackState = ref(new Map<string, FeedbackData | null>());
const copiedMessage = ref<string | null>(null);
const actionError = ref("");
const feedbackMutation = useMutation({
  mutationFn: async (variables: {
    threadId: string;
    runId: string;
    rating: number;
    remove: boolean;
  }) => {
    if (variables.remove) {
      await deleteFeedback(variables.threadId, variables.runId);
      return null;
    }
    return upsertFeedback(
      variables.threadId,
      variables.runId,
      variables.rating,
    );
  },
});
let previousHumanInputThreadError: unknown = props.threadError;
provide(MARKDOWN_LINK_CONTEXT, {
  threadId: computed(() => props.threadId),
  isMock: computed(() => props.isMock),
});

const MarkdownMessageImage = defineComponent({
  name: "MarkdownMessageImage",
  inheritAttrs: false,
  props: {
    src: { type: String, default: "" },
    alt: { type: String, default: "" },
    node: { type: Object, default: undefined },
  },
  setup(imageProps, { attrs }) {
    return () => {
      if (!imageProps.src) return null;
      const src = props.threadId
        ? resolveMessageImageURL(
            imageProps.src,
            props.threadId,
            props.artifactPaths ?? [],
            { fallbackToOutputs: true, isMock: props.isMock },
          )
        : imageProps.src;
      return h(
        MarkdownLink,
        {
          href: src,
          threadId: props.threadId,
          isMock: props.isMock,
          target: "_blank",
          rel: "noopener noreferrer",
        },
        {
          default: () =>
            h("img", {
              ...attrs,
              src,
              alt: imageProps.alt,
              loading: "lazy",
              decoding: "async",
              class: ["max-w-[90%] overflow-hidden rounded-lg", attrs.class],
            }),
        },
      );
    };
  },
});
const messageMarkdownComponents = {
  ...richContentComponents,
  a: MarkdownLink,
  img: MarkdownMessageImage,
};

const groups = computed(() =>
  getMessageGroups(props.messages, {
    isCurrentTurnLoading: props.streaming,
  }),
);
const turnUsageMessagesByGroupIndex = computed(
  () => deriveAssistantTurnUsageState(groups.value).byGroupIndex,
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
  deriveHumanInputThreadState(props.rawMessages ?? props.messages),
);
const scroller = ref<HTMLElement | null>(null);
const historySentinel = ref<HTMLElement | null>(null);
const windowStart = ref<number | null>(null);
const followingTail = ref(true);
const selection = ref<SelectionPayload | null>(null);
let userScrollIntent = false;
let contentResizeObserver: ResizeObserver | undefined;
let historyObserver: IntersectionObserver | undefined;
let historyAnchor: { scrollHeight: number; scrollTop: number } | null = null;
const historyInteractionArmed = ref(false);
let followAnimationFrame: number | undefined;
let retainFollowUntil = 0;
const VIRTUAL_WINDOW_SIZE = 50;
const ESTIMATED_GROUP_HEIGHT_PX = 80;
const RETAIN_FOLLOW_DURATION_MS = 350;

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
function subtaskTerminal(
  toolCallId: string | undefined,
): SubtaskResultUpdate | undefined {
  const result = props.messages.find(
    (message) => message.type === "tool" && message.tool_call_id === toolCallId,
  );
  if (!result) return undefined;
  return parseSubtaskResult(text(result), result.additional_kwargs);
}
function subtaskPendingStatus(toolCallId: string | undefined) {
  return derivePendingSubtaskStatus(
    toolCallId,
    props.messages,
    props.streaming,
  );
}
function subtaskDescription(args: Record<string, unknown> | undefined) {
  return typeof args?.description === "string" ? args.description : "Subtask";
}
function subtaskPrompt(args: Record<string, unknown> | undefined) {
  return typeof args?.prompt === "string" ? args.prompt : "";
}
function subtaskId(
  toolCallId: string | undefined,
  groupIndex: number,
  callIndex: number,
) {
  return toolCallId ?? `task-${groupIndex}-${callIndex}`;
}
async function handleHumanInputSubmit(
  request: HumanInputRequest,
  response: HumanInputResponse,
) {
  pendingHumanInputs.value = new Set([
    ...pendingHumanInputs.value,
    request.request_id,
  ]);
  try {
    if (props.submitHumanInput) {
      const accepted = await props.submitHumanInput(request, response);
      if (accepted === false) {
        const next = new Set(pendingHumanInputs.value);
        next.delete(request.request_id);
        pendingHumanInputs.value = next;
      }
      return;
    }
    emit("humanInput", request, response);
  } catch {
    const next = new Set(pendingHumanInputs.value);
    next.delete(request.request_id);
    pendingHumanInputs.value = next;
  }
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
function readFeedback(message: Message | undefined): FeedbackData | null {
  const raw = message ? Reflect.get(message, "feedback") : null;
  if (!raw || typeof raw !== "object") return null;
  const rating = Reflect.get(raw, "rating");
  const feedbackId = Reflect.get(raw, "feedback_id");
  if ((rating !== 1 && rating !== -1) || typeof feedbackId !== "string") {
    return null;
  }
  const comment = Reflect.get(raw, "comment");
  return {
    feedback_id: feedbackId,
    rating,
    comment: typeof comment === "string" ? comment : null,
  };
}
function feedbackForGroup(index: number) {
  const runId = runIdOfGroup(index);
  if (!runId) return null;
  if (feedbackState.value.has(runId)) {
    return feedbackState.value.get(runId) ?? null;
  }
  return readFeedback(lastAI(index));
}
function setFeedback(runId: string, feedback: FeedbackData | null) {
  const next = new Map(feedbackState.value);
  next.set(runId, feedback);
  feedbackState.value = next;
}
async function toggleFeedback(index: number, rating: 1 | -1) {
  if (!props.threadId) return;
  const runId = runIdOfGroup(index);
  if (!runId || feedbackMutation.isPending.value) return;
  actionError.value = "";
  const previous = feedbackForGroup(index);
  const remove = previous?.rating === rating;
  setFeedback(
    runId,
    remove
      ? null
      : {
          feedback_id: previous?.feedback_id ?? `optimistic:${runId}`,
          rating,
          comment: previous?.comment ?? null,
        },
  );
  try {
    const result = await feedbackMutation.mutateAsync({
      threadId: props.threadId,
      runId,
      rating,
      remove,
    });
    setFeedback(runId, result);
    await queryClient.invalidateQueries({
      queryKey: threadHistoryQueryKey(props.threadId),
      exact: true,
    });
  } catch (error) {
    setFeedback(runId, previous);
    actionError.value =
      error instanceof Error
        ? error.message
        : $i18n.t.value.messages.feedbackFailed;
  }
}
async function copyMessage(key: string, value: string | null) {
  if (!value) return;
  actionError.value = "";
  if (!(await writeTextToClipboard(value))) {
    actionError.value = $i18n.t.value.messages.copyFailed;
    return;
  }
  copiedMessage.value = key;
  setTimeout(() => {
    if (copiedMessage.value === key) copiedMessage.value = null;
  }, 2_000);
}
function scrollToTail(mode: "smooth" | "instant" = "instant") {
  if (!scroller.value || props.active === false || !followingTail.value) return;
  if (mode === "instant") {
    if (followAnimationFrame !== undefined) {
      cancelAnimationFrame(followAnimationFrame);
      followAnimationFrame = undefined;
    }
    scroller.value.scrollTop = scroller.value.scrollHeight;
    return;
  }
  retainFollowUntil = performance.now() + RETAIN_FOLLOW_DURATION_MS;
  if (followAnimationFrame !== undefined) return;
  const animate = () => {
    followAnimationFrame = undefined;
    const element = scroller.value;
    if (!element || props.active === false || !followingTail.value) return;
    const gap = element.scrollHeight - element.clientHeight - element.scrollTop;
    if (gap > 1) {
      const before = element.scrollTop;
      element.scrollTop += Math.max(1, gap * 0.35);
      // A browser can reject a fractional step at a layout boundary. Jumping
      // only in that no-progress case prevents an otherwise endless rAF loop.
      if (element.scrollTop === before)
        element.scrollTop = element.scrollHeight;
    } else if (gap > 0) {
      element.scrollTop = element.scrollHeight;
    }
    if (
      performance.now() < retainFollowUntil ||
      element.scrollHeight - element.clientHeight - element.scrollTop > 1
    ) {
      followAnimationFrame = requestAnimationFrame(animate);
    }
  };
  followAnimationFrame = requestAnimationFrame(animate);
}
function stopFollowingTail() {
  followingTail.value = false;
  if (followAnimationFrame !== undefined) {
    cancelAnimationFrame(followAnimationFrame);
    followAnimationFrame = undefined;
  }
}
function setContentElement(element: Element | ComponentPublicInstance | null) {
  contentResizeObserver?.disconnect();
  contentResizeObserver = undefined;
  if (!(element instanceof HTMLElement)) return;
  if ("ResizeObserver" in globalThis) {
    contentResizeObserver = new ResizeObserver(() => {
      if (!followingTail.value || props.active === false) return;
      scrollToTail(props.resizeScroll ?? "smooth");
    });
    contentResizeObserver.observe(element);
  }
  void nextTick(() => {
    if (followingTail.value && props.active !== false) {
      scrollToTail(props.resizeScroll ?? "smooth");
    }
  });
}
function onScroll() {
  if (!scroller.value) return;
  const maxStart = Math.max(0, groups.value.length - VIRTUAL_WINDOW_SIZE);
  const scrollRange = scroller.value.scrollHeight - scroller.value.clientHeight;
  const atTail =
    scrollRange <= 0 ||
    scroller.value.scrollTop + scroller.value.clientHeight >=
      scroller.value.scrollHeight - 1;
  if (atTail) {
    followingTail.value = true;
    userScrollIntent = false;
    windowStart.value = maxStart;
    return;
  }
  if (
    historyInteractionArmed.value &&
    scroller.value.scrollTop <= 80 &&
    props.hasMoreHistory
  ) {
    requestHistoryLoad();
  }
  if (userScrollIntent) {
    stopFollowingTail();
    userScrollIntent = false;
  }
  if (groups.value.length <= 80) return;
  if (followingTail.value) {
    windowStart.value = maxStart;
    return;
  }
  const ratio = scrollRange <= 0 ? 0 : scroller.value.scrollTop / scrollRange;
  windowStart.value = Math.round(maxStart * ratio);
}
function onScrollIntent() {
  userScrollIntent = true;
  historyInteractionArmed.value = true;
}
function onWheel(event: WheelEvent) {
  if (
    event.deltaY < 0 &&
    scroller.value &&
    scroller.value.scrollHeight > scroller.value.clientHeight
  ) {
    historyInteractionArmed.value = true;
    userScrollIntent = false;
    stopFollowingTail();
  }
}
function onScrollKey(event: KeyboardEvent) {
  if (
    ["ArrowUp", "PageUp", "Home"].includes(event.key) ||
    (event.key === " " && event.shiftKey)
  ) {
    historyInteractionArmed.value = true;
    onScrollIntent();
  }
}
function historyErrorMessage() {
  const error = props.historyError;
  return error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : $i18n.t.value.messages.loadEarlierFailed;
}
function requestHistoryLoad() {
  if (
    !props.hasMoreHistory ||
    props.historyLoadingMore ||
    !scroller.value ||
    historyAnchor
  ) {
    return;
  }
  historyAnchor = {
    scrollHeight: scroller.value.scrollHeight,
    scrollTop: scroller.value.scrollTop,
  };
  stopFollowingTail();
  emit("loadMoreHistory");
}
function onSelection(index: number) {
  if (!props.selectionMode) return;
  const selectedText = globalThis.getSelection?.()?.toString().trim() ?? "";
  if (!selectedText) {
    selection.value = null;
    return;
  }
  const message = [...(groups.value[index]?.messages ?? [])]
    .reverse()
    .find(
      (candidate) =>
        (candidate.type === "human" || candidate.type === "ai") &&
        text(candidate).includes(selectedText),
    );
  selection.value = message
    ? { message, selectedText, displayIndex: index + 1 }
    : null;
}
function onKey(event: KeyboardEvent) {
  if (event.key === "Escape") selection.value = null;
}
function dispatchSelection(action: "ask" | "add") {
  if (!selection.value) return;
  if (action === "ask") emit("selectionAsk", selection.value);
  else emit("selectionAdd", selection.value);
  selection.value = null;
  globalThis.getSelection?.()?.removeAllRanges();
}
function messageReferences(message: Message) {
  return readReferenceMessageContexts(message.additional_kwargs).map(
    (context, index) => ({ id: index + 1, context }),
  );
}
const ARTIFACT_TOOL_NAMES = new Set([
  "write_file",
  "str_replace",
  "finalize_artifact_write",
  "present_files",
]);
function toolLabel(name: string) {
  if (name === "write_file") return $i18n.t.value.toolCalls.writeFile;
  return name
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
function artifactTargets(message: Message) {
  if (message.type !== "ai") return [];
  return (message.tool_calls ?? []).flatMap((call) => {
    if (call.name === "present_files" && Array.isArray(call.args?.filepaths)) {
      return call.args.filepaths.flatMap((path) =>
        typeof path === "string"
          ? [{ path, label: path.split("/").at(-1) ?? path }]
          : [],
      );
    }
    if (
      (call.name === "write_file" || call.name === "str_replace") &&
      typeof call.args?.path === "string"
    ) {
      return [
        {
          path: buildWriteFileArtifactURL({
            filepath: call.args.path,
            messageId: message.id,
            toolCallId: call.id,
          }),
          label: call.args.path,
        },
      ];
    }
    if (
      call.name === "finalize_artifact_write" &&
      typeof call.args?.path === "string"
    ) {
      const result = props.messages.find(
        (candidate) =>
          candidate.type === "tool" && candidate.tool_call_id === call.id,
      );
      if (result && text(result).trim() === "OK") {
        return [{ path: call.args.path, label: call.args.path }];
      }
    }
    return [];
  });
}
function runIdOfGroup(index: number) {
  const messages = groups.value[index]?.messages ?? [];
  for (const message of [...messages].reverse()) {
    const runId = Reflect.get(message, "run_id");
    if (typeof runId === "string" && runId) return runId;
  }
  return undefined;
}
function workspaceChangesRun(index: number) {
  if (groups.value[index]?.type !== "assistant") return undefined;
  const runId = runIdOfGroup(index);
  if (!runId) return undefined;
  for (let cursor = index + 1; cursor < groups.value.length; cursor += 1) {
    if (
      groups.value[cursor]?.type === "assistant" &&
      runIdOfGroup(cursor) === runId
    )
      return undefined;
  }
  return runId;
}
function durationLabel(seconds: number) {
  const copy = $i18n.t.value.runDuration;
  const duration = formatRunDuration(seconds, {
    lessThanSecond: copy.lessThanSecond,
    hours: copy.hours,
    minutes: copy.minutes,
    seconds: copy.seconds,
    separator: copy.separator,
  });
  return duration ? copy.completedIn(duration) : "";
}

watch(
  () => groups.value.length,
  async (nextLength, previousLength = 0) => {
    void previousLength;
    const wasFollowingTail = followingTail.value;

    if (nextLength <= 80) {
      windowStart.value = null;
    } else if (wasFollowingTail) {
      windowStart.value = Math.max(0, nextLength - VIRTUAL_WINDOW_SIZE);
    }

    if (!wasFollowingTail || props.active === false) return;
    await nextTick();
    // A persisted-page refresh can land between the optimistic message and the
    // stream response. DOM scroll events from that intermediate layout may
    // recalculate windowStart before this post-render continuation runs. Pin
    // the virtual window to the current tail again before scrolling so the
    // optimistic turn remains mounted throughout the reconciliation.
    if (groups.value.length > 80) {
      windowStart.value = Math.max(
        0,
        groups.value.length - VIRTUAL_WINDOW_SIZE,
      );
      await nextTick();
    }
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
  },
  { immediate: true },
);
watch(
  () => props.streaming,
  async (streaming) => {
    if (streaming || !followingTail.value || props.active === false) return;
    await nextTick();
    scrollToTail(props.resizeScroll ?? "smooth");
  },
  { flush: "post" },
);
watch(
  () => props.active,
  async (active) => {
    if (!active) return;
    followingTail.value = true;
    await nextTick();
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
  },
  { flush: "post" },
);
watch(
  () => props.tailRequest,
  async (request, previousRequest) => {
    if (
      request === undefined ||
      request === previousRequest ||
      props.active === false
    )
      return;
    followingTail.value = true;
    if (groups.value.length > 80) {
      windowStart.value = Math.max(
        0,
        groups.value.length - VIRTUAL_WINDOW_SIZE,
      );
    }
    await nextTick();
    if (groups.value.length > 80) {
      windowStart.value = Math.max(
        0,
        groups.value.length - VIRTUAL_WINDOW_SIZE,
      );
      await nextTick();
    }
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
  },
);
watch(humanInputState, (state) => {
  if (pendingHumanInputs.value.size === 0) return;
  pendingHumanInputs.value = new Set(
    [...pendingHumanInputs.value].filter(
      (requestId) => !state.answeredResponses.has(requestId),
    ),
  );
});
watch(
  () => props.threadError,
  (currentError) => {
    const clear = shouldClearPendingHumanInputOnThreadError({
      currentError,
      previousError: previousHumanInputThreadError,
      pendingRequestCount: pendingHumanInputs.value.size,
    });
    previousHumanInputThreadError = currentError;
    if (clear) pendingHumanInputs.value = new Set();
  },
);
watch(
  () => props.streaming,
  (streaming, previousStreaming) => {
    if (previousStreaming && !streaming) {
      pendingHumanInputs.value = new Set();
    }
  },
);
watch(
  () => props.threadId,
  () => {
    pendingHumanInputs.value = new Set();
    previousHumanInputThreadError = props.threadError;
    feedbackState.value = new Map();
    actionError.value = "";
  },
);
watch(
  () => props.messages,
  () => {
    if (feedbackMutation.isPending.value) return;
    const next = new Map(feedbackState.value);
    groups.value.forEach((_, index) => {
      const runId = runIdOfGroup(index);
      if (runId) next.set(runId, readFeedback(lastAI(index)));
    });
    feedbackState.value = next;
  },
  { immediate: true },
);
watch(
  () => props.historyLoadingMore,
  async (loading, previous) => {
    if (loading || !previous || !historyAnchor) return;
    await nextTick();
    if (scroller.value) {
      const addedHeight =
        scroller.value.scrollHeight - historyAnchor.scrollHeight;
      scroller.value.scrollTop =
        historyAnchor.scrollTop + Math.max(0, addedHeight);
    }
    historyAnchor = null;
  },
);
watch(
  () => props.threadId,
  () => {
    historyInteractionArmed.value = false;
    historyAnchor = null;
  },
);
watch(historySentinel, (element, previous) => {
  if (previous) historyObserver?.unobserve(previous);
  if (!element || !("IntersectionObserver" in globalThis)) return;
  historyObserver ??= new IntersectionObserver(
    (entries) => {
      if (
        entries.some((entry) => entry.isIntersecting) &&
        historyInteractionArmed.value
      ) {
        requestHistoryLoad();
      }
    },
    { root: scroller.value, rootMargin: "96px 0px 0px" },
  );
  historyObserver.observe(element);
});
onMounted(() => {
  globalThis.addEventListener("keydown", onKey);
});
onUnmounted(() => {
  globalThis.removeEventListener("keydown", onKey);
  contentResizeObserver?.disconnect();
  historyObserver?.disconnect();
  if (followAnimationFrame !== undefined) {
    cancelAnimationFrame(followAnimationFrame);
  }
});
</script>

<template>
  <div
    :data-testid="testId"
    role="log"
    :aria-label="$i18n.t.value.messages.conversation"
    class="min-h-0 flex-1 transition-[padding]"
  >
    <div
      ref="scroller"
      class="h-full overflow-y-auto px-3 sm:px-4"
      @scroll="onScroll"
      @wheel="onWheel"
      @touchstart="onScrollIntent"
      @pointerdown="onScrollIntent"
      @keydown="onScrollKey"
    >
      <div v-if="loading" class="py-8 text-center text-sm text-gray-500">
        {{ $i18n.t.value.messages.loadingConversation }}
      </div>
      <div
        v-if="hasMoreHistory || historyLoadingMore || historyError"
        class="mx-auto flex w-full max-w-[var(--container-width-md)] justify-center pt-3"
      >
        <span v-if="historyError" role="alert" class="text-destructive text-xs">
          {{ historyErrorMessage() }}
          <button
            type="button"
            class="ml-2 underline"
            @click="requestHistoryLoad"
          >
            {{ $i18n.t.value.messages.tryAgain }}
          </button>
        </span>
        <button
          v-else-if="hasMoreHistory && !historyLoadingMore"
          ref="historySentinel"
          data-testid="load-earlier-messages"
          type="button"
          class="text-muted-foreground hover:text-foreground rounded px-3 py-1 text-xs underline"
          @click="requestHistoryLoad"
        >
          {{ $i18n.t.value.messages.loadEarlier }}
        </button>
        <span
          v-else-if="historyLoadingMore"
          role="status"
          class="text-muted-foreground text-xs"
        >
          {{ $i18n.t.value.messages.loadingEarlier }}
        </span>
      </div>
      <ul
        :ref="setContentElement"
        data-testid="message-list"
        class="mx-auto flex w-full max-w-[var(--container-width-md)] list-none flex-col gap-8 pt-8 pb-6"
      >
        <div
          v-if="virtualTopHeight"
          aria-hidden="true"
          :style="{ height: `${virtualTopHeight}px` }"
        />
        <li
          v-for="entry in renderedGroups"
          :key="entry.group.id ?? entry.index"
          :data-index="entry.index"
          :data-assistant-turn="
            entry.group.type === 'assistant' ? '' : undefined
          "
          :data-role="entry.group.type === 'human' ? 'human' : 'ai'"
          :class="
            entry.group.type === 'human'
              ? 'is-user group bg-secondary ml-auto w-fit max-w-full rounded-lg px-4 py-3 whitespace-pre-wrap'
              : 'group relative w-full'
          "
          @mouseup="onSelection(entry.index)"
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
                interactive !== false &&
                humanInputState.latestOpenRequestId ===
                  extractHumanInputRequest(message)!.request_id
              "
              :pending="
                pendingHumanInputs.has(
                  extractHumanInputRequest(message)!.request_id,
                )
              "
              @submit="
                handleHumanInputSubmit(
                  extractHumanInputRequest(message)!,
                  $event,
                )
              "
            />
            <template v-if="message.type === 'human'">
              <MessageAttachments
                :message="message"
                :thread-id="threadId"
                :is-mock="isMock"
              />
              <p>{{ stripUploadedFilesTag(text(message)) }}</p>
              <ReferenceAttachment
                :references="messageReferences(message)"
                test-id="message-reference-attachment"
                class="mt-2"
              />
              <div
                class="text-muted-foreground absolute right-0 -bottom-7 flex gap-2 text-xs opacity-0 transition-opacity group-hover:opacity-100"
              >
                <button
                  type="button"
                  :aria-label="$i18n.t.value.messages.actions.copyMessage"
                  @click="
                    copyMessage(
                      message.id ?? `human:${entry.index}`,
                      getMessageCopyData(message),
                    )
                  "
                >
                  <Check
                    v-if="
                      copiedMessage === (message.id ?? `human:${entry.index}`)
                    "
                    :size="14"
                  />
                  <Copy v-else :size="14" />
                </button>
                <button
                  v-if="
                    interactive !== false &&
                    editable?.humanMessage.id === message.id
                  "
                  type="button"
                  class="hover:underline"
                  :aria-label="$i18n.t.value.messages.actions.editAndRerun"
                  @click="
                    emit(
                      'edit',
                      message.id ?? '',
                      text(message),
                      groupIds(entry.index),
                    )
                  "
                >
                  {{ $i18n.t.value.messages.actions.editAndRerun }}
                </button>
              </div>
            </template>
            <template v-else-if="message.type === 'ai'">
              <details v-if="reasoning(message)" class="mb-3" open>
                <summary
                  role="button"
                  class="text-muted-foreground cursor-pointer text-sm font-medium"
                >
                  {{
                    streaming && entry.index === groups.length - 1
                      ? $i18n.t.value.common.thinking
                      : $i18n.t.value.runDuration.reasoning
                  }}
                </summary>
                <p class="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {{ reasoning(message) }}
                </p>
              </details>
              <StreamMarkdown
                v-if="text(message)"
                :content="getSafeMarkdown(text(message))"
                :components="messageMarkdownComponents"
                :parse-incomplete-markdown="streaming"
              />
              <CitationSourcesPanel :sources="citations(message)" />
              <button
                v-for="artifact in artifactTargets(message)"
                :key="artifact.path"
                type="button"
                class="border-border bg-muted/30 hover:bg-muted my-2 block max-w-full rounded-lg border px-3 py-2 text-left text-sm break-all"
                @click="emit('artifact', artifact.path)"
              >
                {{ artifact.label }}
              </button>
              <div
                v-for="(call, callIndex) in message.tool_calls ?? []"
                :key="subtaskId(call.id, entry.index, callIndex)"
                class="my-2 text-sm"
              >
                <template v-if="call.name === 'task'">
                  <SubtaskCard
                    :task-id="subtaskId(call.id, entry.index, callIndex)"
                    :thread-id="threadId"
                    :run-id="runIdOfGroup(entry.index) ?? activeRunId"
                    :description="subtaskDescription(call.args)"
                    :prompt="subtaskPrompt(call.args)"
                    :live-task="
                      subtasks?.[subtaskId(call.id, entry.index, callIndex)]
                    "
                    :terminal="subtaskTerminal(call.id)"
                    :pending-status="subtaskPendingStatus(call.id)"
                    :is-loading="streaming"
                  />
                </template>
                <template v-else>
                  <details class="group/tool">
                    <summary
                      class="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 py-1.5 transition-colors"
                    >
                      <Wrench :size="15" />
                      <span>{{ toolLabel(call.name) }}</span>
                    </summary>
                    <pre
                      v-if="
                        call.args &&
                        Object.keys(call.args).length &&
                        !ARTIFACT_TOOL_NAMES.has(call.name)
                      "
                      class="bg-muted text-muted-foreground mt-1 ml-6 max-h-64 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap"
                      >{{ JSON.stringify(call.args, null, 2) }}</pre>
                  </details>
                </template>
              </div>
            </template>
            <details v-else-if="message.type === 'tool'" class="my-2 text-sm">
              <summary
                class="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 py-1.5"
              >
                <CheckCircle2 :size="15" />
                {{
                  $i18n.t.value.messages.toolResult(
                    message.name ?? $i18n.t.value.messages.tool,
                  )
                }}
              </summary>
              <pre
                class="bg-muted text-muted-foreground mt-1 ml-6 max-h-64 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap"
                >{{ text(message) }}</pre>
            </details>
          </template>

          <WorkspaceChangesBadge
            v-if="threadId && workspaceChangesRun(entry.index)"
            :thread-id="threadId"
            :run-id="workspaceChangesRun(entry.index)"
            :disabled="streaming"
          />

          <MessageTokenUsage
            v-if="turnUsageMessagesByGroupIndex[entry.index]"
            :messages="turnUsageMessagesByGroupIndex[entry.index] ?? []"
            :mode="tokenUsageInlineMode ?? 'off'"
            :loading="streaming"
          />

          <div
            v-if="entry.group.type === 'assistant'"
            class="text-muted-foreground mt-2 flex gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
          >
            <button
              type="button"
              :aria-label="$i18n.t.value.messages.actions.copyResponse"
              @click="
                copyMessage(
                  `assistant:${entry.group.id ?? entry.index}`,
                  getAssistantTurnCopyData(entry.group.messages, {
                    isStreaming: streaming && entry.index === groups.length - 1,
                  }),
                )
              "
            >
              <Check
                v-if="
                  copiedMessage === `assistant:${entry.group.id ?? entry.index}`
                "
                :size="14"
              />
              <Copy v-else :size="14" />
            </button>
            <template
              v-if="
                interactive !== false &&
                threadId &&
                workspaceChangesRun(entry.index) &&
                !streaming
              "
            >
              <button
                type="button"
                :aria-label="$i18n.t.value.messages.actions.helpful"
                :disabled="feedbackMutation.isPending.value"
                @click="toggleFeedback(entry.index, 1)"
              >
                <ThumbsUp
                  :size="14"
                  :class="
                    feedbackForGroup(entry.index)?.rating === 1
                      ? 'text-foreground fill-current'
                      : ''
                  "
                />
              </button>
              <button
                type="button"
                :aria-label="$i18n.t.value.messages.actions.notHelpful"
                :disabled="feedbackMutation.isPending.value"
                @click="toggleFeedback(entry.index, -1)"
              >
                <ThumbsDown
                  :size="14"
                  :class="
                    feedbackForGroup(entry.index)?.rating === -1
                      ? 'text-foreground fill-current'
                      : ''
                  "
                />
              </button>
            </template>
            <button
              v-if="
                interactive !== false && branchable.has(entry.group.id ?? '')
              "
              type="button"
              :aria-label="$i18n.t.value.messages.actions.branch"
              @click="
                emit('branch', entry.group.id ?? '', groupIds(entry.index))
              "
            >
              <GitBranch :size="14" />
            </button>
            <button
              v-if="
                interactive !== false &&
                entry.index === groups.length - 1 &&
                lastAI(entry.index)?.id
              "
              type="button"
              :aria-label="$i18n.t.value.messages.actions.regenerate"
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
              <RefreshCw :size="14" />
            </button>
          </div>
          <p
            v-for="duration in durations[entry.index] ?? []"
            :key="duration.runId"
            data-testid="run-duration"
            class="text-muted-foreground mt-2 text-xs"
          >
            {{ durationLabel(duration.durationSeconds) }}
          </p>
        </li>
        <div
          v-if="virtualBottomHeight"
          aria-hidden="true"
          :style="{ height: `${virtualBottomHeight}px` }"
        />
      </ul>
      <p
        v-if="actionError"
        role="alert"
        class="text-destructive mx-auto w-full max-w-[var(--container-width-md)] pb-4 text-xs"
      >
        {{ actionError }}
      </p>
    </div>
    <div
      v-if="selection"
      data-sidecar-selection-toolbar
      class="bg-background fixed right-8 bottom-28 z-50 flex gap-1 rounded-md border p-1 shadow"
    >
      <button
        type="button"
        class="hover:bg-accent rounded px-3 py-2 text-sm"
        @click="dispatchSelection('add')"
      >
        {{ $i18n.t.value.sidecar.addToConversation }}
      </button>
      <button
        v-if="selectionMode === 'main'"
        type="button"
        class="hover:bg-accent rounded px-3 py-2 text-sm"
        @click="dispatchSelection('ask')"
      >
        {{ $i18n.t.value.sidecar.askInSideChat }}
      </button>
    </div>
  </div>
</template>
