<script setup lang="ts">
/*
  【文件职责】     组合 live WebSocket 与 static REST 的唯一 browser 控制面板，并映射远端输入。
  【对应 frontend/】 src/components/workspace/browser-view/browser-view-panel.tsx
  【架构位置】     L3
  【主要导出】     默认 BrowserPanel 组件
  【依赖关系】     useBrowserStream · browser core · browser API · artifact URL · Vue Query
  【边界与注意】   模式由连接/REST 结果推导；不向 Gateway 发明 mode/state 字段，不双发 click。
*/
import { useMutation } from "@tanstack/vue-query";
import { ArrowLeft, ArrowRight, Monitor, RefreshCw, X } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { resolveArtifactURL } from "@/core/artifacts/utils";
import type { BrowserViewFrame } from "@/core/browser/frame";
import {
  mapBrowserPoint,
  normalizeBrowserWheel,
  type BrowserNormalizedPoint,
} from "@/core/browser/geometry";
import { decideBrowserKeyInput } from "@/core/browser/keyboard";
import type { BrowserInputEvent } from "@/core/browser/protocol";

import { navigateBrowser } from "./browser-api";
import { useBrowserStream } from "./useBrowserStream";

const props = defineProps<{
  threadId: string;
  active: boolean;
  frame?: BrowserViewFrame | null;
}>();
const emit = defineEmits<{
  close: [];
  frame: [frame: BrowserViewFrame];
}>();
const { $i18n } = useNuxtApp();

const requestedLive = ref(true);
const threadId = computed(() => props.threadId);
const streamEnabled = computed(() => props.active && requestedLive.value);
const localFrame = ref<BrowserViewFrame | null>(null);
const staticFrame = computed(() => localFrame.value ?? props.frame ?? null);
const lastLiveUrl = ref<string | null>(null);
const lastLiveTitle = ref("");
const restTitle = ref("");
const seedUrl = computed(
  () =>
    localFrame.value?.url || lastLiveUrl.value || props.frame?.url || undefined,
);
const stream = useBrowserStream(threadId, streamEnabled, seedUrl);
const url = ref("");
const editingUrl = ref(false);
const surface = ref<HTMLImageElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const browserPanel = ref<HTMLElement | null>(null);
const restError = ref<string | null>(null);
const retryTarget = ref<string | null>(null);
const composing = ref(false);
let restController: AbortController | null = null;
let restGeneration = 0;
let moveFrame: number | null = null;
let pendingMove: BrowserNormalizedPoint | null = null;
let lastPoint: BrowserNormalizedPoint | null = null;
let wheelFrame: number | null = null;
let pendingWheel: {
  dx: number;
  dy: number;
  point: BrowserNormalizedPoint | null;
} | null = null;

const restMutation = useMutation({
  mutationFn: async (variables: {
    threadId: string;
    url: string;
    signal: AbortSignal;
  }) =>
    navigateBrowser(variables.threadId, variables.url, {
      signal: variables.signal,
    }),
});

const liveActive = computed(
  () => requestedLive.value && stream.status.value === "open",
);
const modeLabel = computed(() => {
  if (!requestedLive.value) return $i18n.t.value.browser.static;
  if (stream.status.value === "open") return $i18n.t.value.browser.live;
  if (stream.status.value === "reconnecting") {
    return $i18n.t.value.browser.reconnecting(stream.reconnectAttempt.value, 6);
  }
  if (stream.status.value === "connecting") {
    return $i18n.t.value.browser.connecting;
  }
  return $i18n.t.value.browser.static;
});
const authoritativeTitle = computed(
  () =>
    (liveActive.value ? stream.title.value : "") ||
    restTitle.value ||
    lastLiveTitle.value ||
    staticFrame.value?.title ||
    $i18n.t.value.browser.panelTitle,
);
const displayFrameUrl = computed(() => {
  if (stream.frameUrl.value) return stream.frameUrl.value;
  const screenshot = staticFrame.value?.screenshot;
  return screenshot ? resolveArtifactURL(screenshot, props.threadId) : null;
});
const alertMessage = computed(() => restError.value ?? stream.error.value);

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.matches("input, textarea, select, [contenteditable=true]")
  );
}

function normalizeTarget(value: string): string | null {
  const target = value.trim();
  if (!target) return null;
  return /^https?:\/\//i.test(target) ? target : `https://${target}`;
}

function abortRestNavigation() {
  restGeneration += 1;
  restController?.abort();
  restController = null;
}

async function navigateRest(target: string) {
  abortRestNavigation();
  const generation = restGeneration;
  const controller = new AbortController();
  restController = controller;
  retryTarget.value = target;
  restError.value = null;
  try {
    const result = await restMutation.mutateAsync({
      threadId: props.threadId,
      url: target,
      signal: controller.signal,
    });
    if (
      controller.signal.aborted ||
      generation !== restGeneration ||
      !props.active
    ) {
      return;
    }
    url.value = result.url;
    restTitle.value = result.title;
    retryTarget.value = null;
    const nextFrame: BrowserViewFrame | null = result.screenshot
      ? {
          screenshot: result.screenshot,
          url: result.url,
          title: result.title,
        }
      : null;
    localFrame.value = nextFrame;
    if (nextFrame) emit("frame", nextFrame);
  } catch (cause) {
    if (controller.signal.aborted || generation !== restGeneration) return;
    restError.value =
      cause instanceof Error
        ? cause.message
        : $i18n.t.value.browser.navigationFailedFallback;
  } finally {
    if (generation === restGeneration) restController = null;
  }
}

function navigate() {
  const target = normalizeTarget(url.value);
  if (!target) return;
  url.value = target;
  editingUrl.value = false;
  restError.value = null;
  stream.clearError();
  retryTarget.value = target;
  if (requestedLive.value) {
    const disposition = stream.sendInput({ type: "navigate", url: target });
    if (disposition !== "unavailable") return;
  }
  requestedLive.value = false;
  void navigateRest(target);
}

function retryNavigation() {
  if (retryTarget.value) void navigateRest(retryTarget.value);
}

function toggleLive() {
  requestedLive.value = !requestedLive.value;
  restError.value = null;
  if (requestedLive.value) stream.clearError();
}

function retryLive() {
  requestedLive.value = true;
  stream.retry();
}

function pointFromEvent(event: { clientX: number; clientY: number }) {
  const image = surface.value;
  if (
    !image ||
    !Number.isFinite(event.clientX) ||
    !Number.isFinite(event.clientY)
  ) {
    return null;
  }
  return mapBrowserPoint({
    clientX: event.clientX,
    clientY: event.clientY,
    rect: image.getBoundingClientRect(),
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  });
}

function sendLiveInput(input: BrowserInputEvent): boolean {
  return liveActive.value && stream.sendInput(input) === "sent";
}

function clickFrame(event: MouseEvent) {
  const point = pointFromEvent(event);
  if (!point) return;
  lastPoint = point;
  sendLiveInput({ type: "click", ...point });
}

function moveFrameInput(event: MouseEvent) {
  if (!liveActive.value) return;
  pendingMove = pointFromEvent(event);
  if (!pendingMove || moveFrame !== null) return;
  lastPoint = pendingMove;
  moveFrame = requestAnimationFrame(() => {
    moveFrame = null;
    const point = pendingMove;
    pendingMove = null;
    if (point) sendLiveInput({ type: "move", ...point });
  });
}

function onWheel(event: WheelEvent) {
  if (!liveActive.value) return;
  const delta = normalizeBrowserWheel(event);
  if (!delta.dx && !delta.dy) return;
  event.preventDefault();
  event.stopPropagation();
  const point = pointFromEvent(event) ?? lastPoint;
  if (pendingWheel) {
    pendingWheel.dx += delta.dx;
    pendingWheel.dy += delta.dy;
    if (point) pendingWheel.point = point;
  } else {
    pendingWheel = { ...delta, point };
  }
  if (wheelFrame !== null) return;
  wheelFrame = requestAnimationFrame(() => {
    wheelFrame = null;
    const pending = pendingWheel;
    pendingWheel = null;
    if (!pending) return;
    sendLiveInput({
      type: "wheel",
      dx: pending.dx,
      dy: pending.dy,
      ...(pending.point ?? {}),
    });
  });
}

function onKeydown(event: KeyboardEvent) {
  const input = decideBrowserKeyInput({
    eventType: "keydown",
    live: liveActive.value,
    editableTarget: isEditableTarget(event.target),
    composing: composing.value || event.isComposing,
    key: event.key,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
  });
  if (!input || stream.sendInput(input) !== "sent") return;
  event.preventDefault();
  event.stopPropagation();
}

function onCompositionEnd(event: CompositionEvent) {
  composing.value = false;
  if (
    !event.data ||
    isEditableTarget(event.target) ||
    !sendLiveInput({ type: "text", text: event.data })
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
}

function sendHistory(type: "back" | "forward") {
  sendLiveInput({ type });
}

function closePanel() {
  requestedLive.value = false;
  abortRestNavigation();
  emit("close");
}

watch(
  () => stream.liveUrl.value,
  (nextUrl) => {
    if (nextUrl && !editingUrl.value) {
      lastLiveUrl.value = nextUrl;
      url.value = nextUrl;
      retryTarget.value = null;
      restError.value = null;
    }
  },
);

watch(
  () => stream.title.value,
  (nextTitle) => {
    if (nextTitle) lastLiveTitle.value = nextTitle;
  },
);

watch(
  staticFrame,
  (nextFrame) => {
    if (!editingUrl.value && !stream.liveUrl.value)
      url.value = nextFrame?.url ?? "";
  },
  { immediate: true },
);

watch(
  () => stream.fallbackNavigate.value,
  (fallback) => {
    if (!fallback || !props.active) return;
    requestedLive.value = false;
    void navigateRest(fallback.url);
  },
);

watch(
  () => props.active,
  (active) => {
    if (!active) abortRestNavigation();
  },
);

onMounted(() => {
  stage.value?.addEventListener("wheel", onWheel, { passive: false });
});

onBeforeUnmount(() => {
  stage.value?.removeEventListener("wheel", onWheel);
  abortRestNavigation();
  if (moveFrame !== null) cancelAnimationFrame(moveFrame);
  if (wheelFrame !== null) cancelAnimationFrame(wheelFrame);
});
</script>

<template>
  <section
    ref="browserPanel"
    data-testid="browser-panel"
    class="bg-background flex size-full flex-col"
    tabindex="0"
    @keydown="onKeydown"
    @compositionstart="composing = true"
    @compositionend="onCompositionEnd"
  >
    <header
      class="border-border flex h-12 shrink-0 items-center gap-2 border-b px-3"
    >
      <Monitor :size="16" />
      <span data-testid="browser-title" class="max-w-40 truncate font-medium">
        {{ authoritativeTitle }}
      </span>
      <button
        type="button"
        :aria-label="$i18n.t.value.browser.back"
        class="rounded p-1"
        :disabled="!liveActive"
        @click="sendHistory('back')"
      >
        <ArrowLeft :size="16" />
      </button>
      <button
        type="button"
        :aria-label="$i18n.t.value.browser.forward"
        class="rounded p-1"
        :disabled="!liveActive"
        @click="sendHistory('forward')"
      >
        <ArrowRight :size="16" />
      </button>
      <form class="flex min-w-0 flex-1" @submit.prevent="navigate">
        <input
          v-model="url"
          :aria-label="$i18n.t.value.browser.urlLabel"
          :placeholder="$i18n.t.value.browser.urlPlaceholder"
          class="border-input w-full rounded-md border px-3 py-1.5 text-sm"
          @focus="editingUrl = true"
          @blur="editingUrl = false"
          @keydown.stop
          @compositionstart.stop
          @compositionend.stop
        />
      </form>
      <button
        type="button"
        :aria-label="
          requestedLive
            ? $i18n.t.value.browser.switchToStatic
            : $i18n.t.value.browser.switchToLive
        "
        class="rounded px-2 py-1 text-xs"
        @click="toggleLive"
      >
        <span data-testid="browser-mode">{{ modeLabel }}</span>
      </button>
      <button
        type="button"
        :aria-label="$i18n.t.value.browser.close"
        class="rounded p-1"
        @click="closePanel"
      >
        <X :size="16" />
      </button>
    </header>

    <p
      v-if="alertMessage"
      role="alert"
      class="bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {{ alertMessage }}
      <button
        v-if="restError && retryTarget"
        type="button"
        :aria-label="$i18n.t.value.browser.retryNavigation"
        class="ml-2 underline"
        @click="retryNavigation"
      >
        {{ $i18n.t.value.browser.retryNavigation }}
      </button>
      <button
        v-else-if="stream.canRetry.value"
        type="button"
        :aria-label="$i18n.t.value.browser.retryLive"
        class="ml-2 inline-flex items-center gap-1 underline"
        @click="retryLive"
      >
        <RefreshCw :size="12" /> {{ $i18n.t.value.browser.retryLive }}
      </button>
    </p>

    <main
      ref="stage"
      data-testid="browser-stage"
      class="relative min-h-0 flex-1 bg-neutral-950"
      @mousedown="browserPanel?.focus()"
    >
      <img
        v-if="displayFrameUrl"
        ref="surface"
        :src="displayFrameUrl"
        :alt="authoritativeTitle"
        draggable="false"
        class="absolute inset-0 size-full object-contain"
        @click="clickFrame"
        @mousemove="moveFrameInput"
      />
      <div
        v-else
        class="text-muted-foreground absolute inset-0 grid place-items-center"
      >
        {{
          requestedLive
            ? $i18n.t.value.browser.connectingFrame
            : $i18n.t.value.browser.noFrame
        }}
      </div>
    </main>
  </section>
</template>
