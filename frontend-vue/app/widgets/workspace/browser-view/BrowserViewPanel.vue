<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { browserFrameUrl, navigateBrowser } from "../../../core/api/browser/client";
import type { BrowserFrame } from "../../../core/api/browser/client";
import { decideBrowserKeyInput } from "./keyboard";
import type { BrowserInputEvent } from "./use-browser-stream";
import { useBrowserStream } from "./use-browser-stream";
import BrowserViewStatus from "./BrowserViewStatus.vue";

const props = defineProps<{
  open: boolean;
  threadId: string;
  initialFrame?: BrowserFrame | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const open = computed(() => props.open);
const threadId = computed(() => props.threadId);
const live = ref(true);
const urlInput = ref("");
const navigating = ref(false);
const staticFrame = ref<BrowserFrame | null>(props.initialFrame ?? null);
const seedUrl = ref<string | undefined>(props.initialFrame?.url);
const navigationError = ref<string | null>(null);
const stream = useBrowserStream(threadId, open, seedUrl, (_url, message) => {
  navigating.value = false;
  navigationError.value = message?.replace(/^Error:\s*/i, "") ?? "无法打开浏览器页面。";
});
const surface = ref<HTMLImageElement | null>(null);
const displayedFrame = computed(() => stream.latestFrame.value ?? staticFrame.value);
const imageUrl = computed(() => browserFrameUrl(displayedFrame.value, props.threadId) ?? stream.frameUrl.value);

watch(
  () => props.initialFrame,
  (frame) => {
    if (frame) {
      staticFrame.value = frame;
      seedUrl.value = frame.url;
    }
  },
  { immediate: true },
);
watch(stream.liveUrl, (url) => {
  if (url) {
    seedUrl.value = url;
    if (!urlInput.value) urlInput.value = url;
  }
});
watch(live, (isLive, wasLive) => {
  if (!isLive && wasLive) {
    staticFrame.value = stream.latestFrame.value ?? staticFrame.value;
  }
});

function normalizeUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

async function navigate(): Promise<void> {
  const target = urlInput.value.trim();
  if (!target) return;
  const url = normalizeUrl(target);
  navigationError.value = null;
  if (live.value) {
    stream.sendInput({ type: "navigate", url });
    urlInput.value = url;
    navigating.value = true;
    window.setTimeout(() => { navigating.value = false; }, 1200);
    return;
  }
  if (navigating.value) return;
  navigating.value = true;
  try {
    const result = await navigateBrowser(props.threadId, url);
    if (!result.screenshot) {
      navigationError.value = "页面已打开，但未捕获到截图。";
      return;
    }
    urlInput.value = result.url;
    staticFrame.value = { screenshot: result.screenshot, url: result.url, title: result.title };
    seedUrl.value = result.url;
  } catch (error) {
    navigationError.value = error instanceof Error ? error.message : "无法打开浏览器页面。";
  } finally {
    navigating.value = false;
  }
}

function send(event: BrowserInputEvent): void {
  if (live.value) stream.sendInput(event);
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target;
  const editableTarget = target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || (target instanceof HTMLElement && target.isContentEditable);
  const input = decideBrowserKeyInput({
    live: live.value,
    editableTarget,
    composing: event.isComposing || event.keyCode === 229,
    key: event.key,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
  });
  if (input) {
    send(input);
    event.preventDefault();
  }
}

function normalizedPoint(event: MouseEvent): { nx: number; ny: number } | null {
  const image = surface.value;
  if (!image || !image.naturalWidth || !image.naturalHeight) return null;
  const rect = image.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  const contentWidth = image.naturalWidth * scale;
  const contentHeight = image.naturalHeight * scale;
  const offsetX = (rect.width - contentWidth) / 2;
  const offsetY = (rect.height - contentHeight) / 2;
  const x = event.clientX - rect.left - offsetX;
  const y = event.clientY - rect.top - offsetY;
  if (x < 0 || y < 0 || x > contentWidth || y > contentHeight) return null;
  return { nx: x / contentWidth, ny: y / contentHeight };
}

function onClick(event: MouseEvent): void {
  const point = normalizedPoint(event);
  if (live.value && point) send({ type: "click", ...point });
}

function onWheel(event: WheelEvent): void {
  if (!live.value) return;
  const point = normalizedPoint(event) ?? { nx: 0.5, ny: 0.5 };
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1;
  const dx = event.deltaX * unit * 2;
  const dy = event.deltaY * unit * 2;
  if (dx || dy) send({ type: "wheel", dx, dy, ...point });
}
</script>

<template>
  <section v-if="props.open" class="workspace-browser-view" data-testid="browser-view-panel" tabindex="0" @keydown="onKeydown">
    <header class="workspace-browser-view__header">
      <strong>浏览器</strong>
      <button type="button" :disabled="!live" title="后退" @click="send({ type: 'back' })">←</button>
      <button type="button" :disabled="!live" title="前进" @click="send({ type: 'forward' })">→</button>
      <form class="workspace-browser-view__url" @submit.prevent="navigate">
        <input v-model="urlInput" type="url" autocomplete="off" placeholder="输入 URL 后按 Enter">
        <button type="submit" :disabled="navigating">打开</button>
      </form>
      <BrowserViewStatus :live="live" :navigating="navigating" :status="stream.status.value" />
      <button type="button" data-testid="browser-view-live-toggle" @click="live = !live">{{ live ? "实时" : "接管" }}</button>
      <button type="button" title="关闭浏览器面板" @click="live = false; emit('close')">×</button>
    </header>
    <p v-if="navigationError" class="workspace-browser-view__error" role="alert">{{ navigationError }}</p>
    <main class="workspace-browser-view__stage" @wheel.prevent.stop="onWheel">
      <img v-if="imageUrl" ref="surface" :src="imageUrl" alt="浏览器页面" draggable="false" @click="onClick">
      <div v-else class="workspace-browser-view__empty" role="status">
        {{ live ? "正在连接浏览器..." : "暂无浏览器活动" }}
      </div>
      <div v-if="navigating" class="workspace-browser-view__loading" data-testid="browser-view-loading">⌛</div>
    </main>
  </section>
</template>
