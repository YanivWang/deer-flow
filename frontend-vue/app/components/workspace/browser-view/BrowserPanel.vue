<script setup lang="ts">
/*
  【文件职责】     组合 live WebSocket 与 static REST 的唯一 browser 控制面板，并映射远端输入。
  【架构位置】     L3
  【主要导出】     默认 BrowserPanel 组件
  【依赖关系】     useBrowserStream · browser core · browser API · artifact URL · ui/{button,input,conversation} · Vue Query
  【边界与注意】   模式由连接/REST 结果推导；不向 Gateway 发明 mode/state 字段，不双发 click。

                   头部逐件对着上游 browser-view-panel.tsx:340 摆：Button / Input primitive、
                   前进后退外面那层 `flex shrink-0 items-center`、地址栏的 GlobeIcon、
                   以及两处 Loader2（地址栏右侧 + 舞台遮罩）。原来整条头部是手搓的，
                   实测被撑到 URL 栏只剩 36.6px 宽（上游同一屏是 129.3）——那不是调
                   `flex-1` 能修的，是标题 98.7 + 模式按钮 113.9 两块把它挤没了。

                   **有意与上游不同的四处，都不是疏忽：**
                   1. `border-border`：上游 globals.css 有 `* { @apply border-border }`
                      的基础层，本仓 main.css 没有，裸 `border-b` 会落到 currentColor。
                   2. 关闭按钮的 `browser.close`：上游那颗按钮**没有任何可访问名**
                      （无 aria-label、无 title，XIcon 还是 aria-hidden），是 WCAG 4.1.2
                      缺陷。按「根因在 frontend/ 就两边同改」的边界，上游同一颗按钮补上了
                      `t.common.closeBrowser`，两边念同一句，台账仍是 0。
                   3. `role="alert"` 那条内联错误 + 重试入口：上游走 toast，而且重连预算
                      耗尽之后**什么都不显示**。本仓保留内联提示与重试。对照看不见它——
                      mock 后端没有 WS 端点时要 32 秒才耗尽 6 次预算，取样点在 settle+700ms。
                   4. 画面上的 `@mousemove`：上游 forwardMouse 只接了 onClick。本仓多发
                      move（远端页面的 hover 态因此能用），走 WS，台账看不见，
                      由 browser-panel.dom.test.ts 守着。

                   **头部不再显示页面标题**（上游那一格是写死的面板标签 `t.common.browser`，
                   和左边的 MonitorIcon 是一对）。页面标题现在只剩 `<img alt>` 一个出口，
                   与上游 `alt={frame?.title ?? "Browser view"}` 同源。
*/
import { useMutation } from "@tanstack/vue-query";
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Loader2,
  Monitor,
  Radio,
  RefreshCw,
  X,
} from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { Button } from "@/components/ui/button";
import { ConversationEmptyState } from "@/components/ui/conversation";
import { Input } from "@/components/ui/input";
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

/*
  上游点一次 Live 导航后亮 1200ms 的转圈：screencast 是连续帧，没有哪一帧算「到了」，
  所以只能给一个固定窗口当反馈（browser-view-panel.tsx:161）。
*/
const LIVE_NAV_SPINNER_MS = 1200;

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
const liveNavigating = ref(false);
let navSpinnerTimer: ReturnType<typeof setTimeout> | null = null;
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
/*
  上游只有 connecting / open / closed 三态，重连时它是把整个 effect 重跑一遍，
  于是又回到 connecting。本仓的控制器把退避等待单独记成 `reconnecting`，真正
  开 socket 的那一刻仍然是 `connecting`——所以这里比的是同一段时间。
*/
const liveConnecting = computed(
  () => requestedLive.value && stream.status.value === "connecting",
);
/** 上游 browser-view-panel.tsx:408 的两态：请求了 Live 但还没连上画 "…"，其余都画 Live。 */
const liveLabel = computed(() =>
  requestedLive.value && stream.status.value !== "open"
    ? "…"
    : $i18n.t.value.browser.live,
);
const navigating = computed(
  () => liveNavigating.value || restMutation.isPending.value,
);
const displayFrameUrl = computed(() => {
  if (stream.frameUrl.value) return stream.frameUrl.value;
  const screenshot = staticFrame.value?.screenshot;
  return screenshot ? resolveArtifactURL(screenshot, props.threadId) : null;
});
/** 与上游 `alt={frame?.title ?? "Browser view"}` 同源：取静态帧的标题，不取 live 标题。 */
const frameAlt = computed(
  () => staticFrame.value?.title ?? $i18n.t.value.browser.panelTitle,
);
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

function stopNavSpinner() {
  if (navSpinnerTimer !== null) {
    clearTimeout(navSpinnerTimer);
    navSpinnerTimer = null;
  }
  liveNavigating.value = false;
}

function startNavSpinner() {
  if (navSpinnerTimer !== null) clearTimeout(navSpinnerTimer);
  liveNavigating.value = true;
  navSpinnerTimer = setTimeout(() => {
    navSpinnerTimer = null;
    liveNavigating.value = false;
  }, LIVE_NAV_SPINNER_MS);
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
    if (disposition !== "unavailable") {
      startNavSpinner();
      return;
    }
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

function selectUrl(event: FocusEvent) {
  editingUrl.value = true;
  (event.target as HTMLInputElement | null)?.select();
}

function closePanel() {
  requestedLive.value = false;
  abortRestNavigation();
  emit("close");
}

watch(
  () => stream.liveUrl.value,
  (nextUrl) => {
    if (!nextUrl) return;
    /*
      上游只把**写回地址栏**这一步挡在编辑态后面，`lastLiveUrl` 与「导航结束」是
      无条件的（browser-view-panel.tsx:127）。本仓原来把三件事一起挡住了，于是
      用户正在输入时到达的 live URL 不会进 seed，下一次重连会用一个过期的地址开机。
    */
    lastLiveUrl.value = nextUrl;
    stopNavSpinner();
    if (editingUrl.value) return;
    url.value = nextUrl;
    retryTarget.value = null;
    restError.value = null;
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
  stopNavSpinner();
  if (moveFrame !== null) cancelAnimationFrame(moveFrame);
  if (wheelFrame !== null) cancelAnimationFrame(wheelFrame);
});
</script>

<template>
  <section
    ref="browserPanel"
    data-testid="browser-panel"
    class="bg-background flex size-full flex-col"
    :tabindex="requestedLive ? 0 : undefined"
    @keydown="onKeydown"
    @compositionstart="composing = true"
    @compositionend="onCompositionEnd"
  >
    <header
      class="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2"
    >
      <Monitor class="size-4 shrink-0" />
      <span class="shrink-0 text-sm font-medium">
        {{ $i18n.t.value.common.browser }}
      </span>
      <!--
        前进/后退外面这层容器是上游有的（browser-view-panel.tsx:343）：两颗按钮之间
        **不吃 header 的 gap-2**，是一对紧挨着的图标键。少了它两颗会被推开 8px，
        后面每一件跟着位移。
      -->
      <div class="flex shrink-0 items-center">
        <Button
          size="icon-sm"
          variant="ghost"
          class="shrink-0"
          :disabled="!requestedLive"
          :title="$i18n.t.value.browser.back"
          @click="sendHistory('back')"
        >
          <ArrowLeft />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          class="shrink-0"
          :disabled="!requestedLive"
          :title="$i18n.t.value.browser.forward"
          @click="sendHistory('forward')"
        >
          <ArrowRight />
        </Button>
      </div>
      <form
        class="relative flex min-w-0 flex-1 items-center"
        @submit.prevent="navigate"
      >
        <Globe
          class="text-muted-foreground pointer-events-none absolute left-2 size-3.5"
        />
        <!--
          **不要给它 aria-label**：上游这颗输入框的可访问名来自 placeholder
          （"Enter a URL and press Enter"）。本仓原来挂了一条 `browser.urlLabel`
          （"Browser URL"），它会把 placeholder 顶掉——屏幕阅读器只念得到「浏览器网址」，
          「输入网址后按 Enter」这句操作提示整段丢失。与 wave 16 在 sidecar textarea 上
          修掉的是同一个毛病；那条词条已随之删掉，别再加回来。
        -->
        <Input
          v-model="url"
          :placeholder="$i18n.t.value.browser.urlPlaceholder"
          spellcheck="false"
          autocomplete="off"
          class="h-8 pl-7 text-xs"
          @focus="selectUrl"
          @blur="editingUrl = false"
          @keydown.stop
          @compositionstart.stop
          @compositionend.stop
        />
        <Loader2
          v-if="navigating"
          class="text-muted-foreground absolute right-2 size-3.5 animate-spin"
        />
      </form>
      <Button
        data-testid="browser-mode"
        size="sm"
        :variant="requestedLive ? 'default' : 'ghost'"
        class="shrink-0 gap-1"
        :title="
          requestedLive
            ? $i18n.t.value.browser.stopLiveControl
            : $i18n.t.value.browser.takeLiveControl
        "
        @click="toggleLive"
      >
        <Radio class="size-3.5" />
        {{ liveLabel }}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        class="shrink-0"
        :aria-label="$i18n.t.value.browser.close"
        @click="closePanel"
      >
        <X />
      </Button>
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
      class="relative flex min-h-0 grow flex-col overflow-hidden bg-neutral-950"
    >
      <!--
        舞台是 main 里面单独的一层，不是 main 自己：上游 browser-view-panel.tsx:423
        把 stageRef / onMouseDown / bg-neutral-900 都挂在这一层，main 只负责
        `flex-col overflow-hidden` 与更深的 bg-neutral-950。本仓原来把两层压成
        一个 main，于是**画面背后露出来的是 neutral-950 而不是 neutral-900**。
        两层的盒子实际重合（main 的唯一 flex 子节点带 grow），所以这不是几何差异，
        只是底色差一档。
      -->
      <div
        ref="stage"
        data-testid="browser-stage"
        class="relative min-h-0 grow bg-neutral-900"
        @mousedown="browserPanel?.focus()"
      >
        <img
          v-if="displayFrameUrl"
          ref="surface"
          :src="displayFrameUrl"
          :alt="frameAlt"
          draggable="false"
          class="absolute inset-0 size-full cursor-default object-contain object-center"
          @click="clickFrame"
          @mousemove="moveFrameInput"
        />
        <ConversationEmptyState
          v-else
          class="absolute inset-0 m-auto h-fit"
          :title="
            requestedLive
              ? $i18n.t.value.browser.connectingFrame
              : $i18n.t.value.browser.noFrame
          "
          :description="
            requestedLive
              ? $i18n.t.value.browser.connectingFrameDescription
              : $i18n.t.value.browser.noFrameDescription
          "
        >
          <template #icon><Monitor /></template>
        </ConversationEmptyState>
        <!--
          舞台遮罩：上游 browser-view-panel.tsx:453。只有**已经有画面**时才盖，
          没有画面那一支归空状态管，两个都画会叠出一层白纱。
        -->
        <div
          v-if="(navigating || liveConnecting) && displayFrameUrl"
          class="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]"
        >
          <Loader2 class="text-muted-foreground size-8 animate-spin" />
        </div>
      </div>
    </main>
  </section>
</template>
