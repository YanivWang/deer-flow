<!--
  【文件职责】     以一个 splitpanes 组承载聊天区与 artifacts/sidecar/browser 共用右侧面板。
  【对应 frontend/】 frontend/src/components/workspace/chats/chat-box.tsx
  【架构位置】     L3 workspace layout
  【主要导出】     WorkspacePanels
  【依赖关系】     splitpanes；面板业务开关仍由 AgentChat 的唯一状态路径拥有
  【边界与注意】   拖拽中的 resize 只记正宽；只有 resized（pointer release）可镜像折叠状态。
-->

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  Pane,
  Splitpanes,
  type SplitpanesResizePayload,
  type SplitpanesResizedPayload,
} from "splitpanes";

const props = withDefaults(
  defineProps<{
    open: boolean;
    panelSize: number;
    animate?: boolean;
    panelLabel?: string;
  }>(),
  { animate: true, panelLabel: "Conversation panel" },
);
const emit = defineEmits<{
  "update:panelSize": [value: number];
  collapse: [];
}>();

const ANIMATION_MS = 280;
const MIN_OPEN_SIZE = 20;
const MAX_OPEN_SIZE = 72;
const COLLAPSE_THRESHOLD = 8;

const group = ref<HTMLElement | null>(null);
const mainRegion = ref<HTMLElement | null>(null);
const panelRegion = ref<HTMLElement | null>(null);
const dragging = ref(false);
const animating = ref(false);
const lastPositiveSize = ref(clampOpenSize(props.panelSize));
const pinnedContentWidth = ref<string | null>(null);
let animationTimer: ReturnType<typeof setTimeout> | undefined;
let splitter: HTMLElement | null = null;

const sideSize = computed(() =>
  props.open ? clampOpenSize(props.panelSize) : 0,
);
const mainSize = computed(() => 100 - sideSize.value);
const contentVisible = computed(() => props.open || animating.value);

function clampOpenSize(value: number) {
  return Math.max(MIN_OPEN_SIZE, Math.min(MAX_OPEN_SIZE, value));
}

function sidePaneSize(payload: { panes: { size: number }[] }) {
  return payload.panes[1]?.size ?? 0;
}

function rememberPositiveSize(value: number) {
  if (value >= COLLAPSE_THRESHOLD) {
    lastPositiveSize.value = clampOpenSize(value);
  }
}

function syncSplitterA11y() {
  const next = group.value?.querySelector<HTMLElement>(".splitpanes__splitter");
  if (splitter !== next) {
    splitter?.removeEventListener("keydown", onSplitterKeydown);
    splitter?.removeEventListener("mouseenter", onSplitterMouseEnter);
    splitter?.removeEventListener("mouseleave", onSplitterMouseLeave);
    splitter?.removeEventListener("mousedown", onSplitterMouseDown);
    splitter = next ?? null;
    splitter?.addEventListener("keydown", onSplitterKeydown);
    splitter?.addEventListener("mouseenter", onSplitterMouseEnter);
    splitter?.addEventListener("mouseleave", onSplitterMouseLeave);
    splitter?.addEventListener("mousedown", onSplitterMouseDown);
  }
  if (!splitter) return;
  splitter.setAttribute("data-slot", "resizable-handle");
  splitter.setAttribute(
    "data-separator",
    !props.open
      ? "disabled"
      : dragging.value
        ? "active"
        : splitter.matches(":hover")
          ? "hover"
          : "inactive",
  );
  splitter.setAttribute("role", "separator");
  splitter.setAttribute("aria-label", "Resize conversation panel");
  splitter.setAttribute("aria-orientation", "vertical");
  splitter.setAttribute("aria-valuemin", String(MIN_OPEN_SIZE));
  splitter.setAttribute("aria-valuemax", String(MAX_OPEN_SIZE));
  splitter.setAttribute("aria-valuenow", String(Math.round(sideSize.value)));
  splitter.setAttribute("aria-disabled", String(!props.open));
  splitter.tabIndex = props.open ? 0 : -1;
}

function onSplitterMouseEnter() {
  syncSplitterA11y();
}

function onSplitterMouseLeave() {
  syncSplitterA11y();
}

function onSplitterMouseDown() {
  dragging.value = true;
  animating.value = false;
  syncSplitterA11y();
}

function updatePanelSize(value: number) {
  const next = clampOpenSize(value);
  lastPositiveSize.value = next;
  emit("update:panelSize", next);
  void nextTick(syncSplitterA11y);
}

function onSplitterKeydown(event: KeyboardEvent) {
  if (!props.open) return;
  if (event.key === "End") {
    event.preventDefault();
    emit("collapse");
    return;
  }
  if (event.key === "Home") {
    event.preventDefault();
    updatePanelSize(MAX_OPEN_SIZE);
    return;
  }
  const delta = event.shiftKey ? 10 : 2;
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    updatePanelSize(sideSize.value + delta);
  } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    const next = sideSize.value - delta;
    if (next < COLLAPSE_THRESHOLD) emit("collapse");
    else updatePanelSize(next);
  }
}

function onResize(payload: SplitpanesResizePayload) {
  dragging.value = true;
  animating.value = false;
  rememberPositiveSize(sidePaneSize(payload));
  void nextTick(syncSplitterA11y);
}

function onResized(payload: SplitpanesResizedPayload) {
  // splitpanes also emits `resized` for programmatic prop updates and pane
  // registration. Only a payload carrying the pointer event is a released
  // drag and may mirror a zero-width layout back to business state.
  if (!payload.event) {
    void nextTick(syncSplitterA11y);
    return;
  }
  dragging.value = false;
  const finalSize = sidePaneSize(payload);
  if (finalSize < COLLAPSE_THRESHOLD) {
    emit("collapse");
  } else {
    updatePanelSize(finalSize);
  }
}

watch(
  () => props.panelSize,
  (value) => rememberPositiveSize(value),
);

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        panelRegion.value?.contains(active)
      ) {
        mainRegion.value?.focus({ preventScroll: true });
        if (document.activeElement === active) active.blur();
      }
    }

    clearTimeout(animationTimer);
    if (!props.animate) {
      animating.value = false;
      pinnedContentWidth.value = null;
      await nextTick();
      syncSplitterA11y();
      return;
    }

    pinnedContentWidth.value = `${lastPositiveSize.value}cqw`;
    animating.value = true;
    await nextTick();
    syncSplitterA11y();
    animationTimer = setTimeout(() => {
      animating.value = false;
      pinnedContentWidth.value = null;
    }, ANIMATION_MS);
  },
);

onMounted(() => void nextTick(syncSplitterA11y));
onBeforeUnmount(() => {
  clearTimeout(animationTimer);
  splitter?.removeEventListener("keydown", onSplitterKeydown);
  splitter?.removeEventListener("mouseenter", onSplitterMouseEnter);
  splitter?.removeEventListener("mouseleave", onSplitterMouseLeave);
  splitter?.removeEventListener("mousedown", onSplitterMouseDown);
});
</script>

<template>
  <div ref="group" class="size-full min-h-0 min-w-0 overflow-hidden">
    <Splitpanes
      data-slot="resizable-panel-group"
      class="workspace-panels size-full min-h-0 min-w-0"
      :class="{
        'workspace-panels--animating': animating && !dragging,
        'workspace-panels--dragging': dragging,
        'workspace-panels--closed': !open,
      }"
      :push-other-panes="false"
      @resize="onResize"
      @resized="onResized"
    >
      <Pane
        :size="mainSize"
        min-size="28"
        data-panel
        class="workspace-panels__main-pane"
        :style="{ flexGrow: mainSize }"
      >
        <div
          id="chat"
          ref="mainRegion"
          tabindex="-1"
          class="relative size-full min-h-0 min-w-0"
        >
          <slot name="main" />
        </div>
      </Pane>
      <Pane
        :size="sideSize"
        min-size="0"
        :max-size="MAX_OPEN_SIZE"
        data-panel
        class="workspace-panels__side-pane"
        :class="{
          'workspace-panels__side-pane--visible': contentVisible,
        }"
        :style="{ flexGrow: sideSize }"
      >
        <aside
          ref="panelRegion"
          :role="open ? 'dialog' : undefined"
          :aria-label="open ? panelLabel : undefined"
          :aria-hidden="!open"
          :inert="!open"
          class="size-full min-h-0 min-w-0 overflow-hidden transition-opacity duration-280 ease-out motion-reduce:transition-none"
          :class="open ? 'opacity-100' : 'pointer-events-none opacity-0'"
          @keydown.esc="emit('collapse')"
        >
          <div
            v-show="contentVisible"
            class="ml-auto h-full min-w-0 overflow-hidden md:min-w-[20rem]"
            :style="
              pinnedContentWidth === null
                ? undefined
                : { width: pinnedContentWidth }
            "
          >
            <slot name="panel" />
          </div>
        </aside>
      </Pane>
    </Splitpanes>
  </div>
</template>

<style scoped>
.workspace-panels {
  container-type: inline-size;
}

.workspace-panels :deep(.splitpanes__pane) {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  transition:
    width 280ms ease-out,
    flex-grow 280ms ease-out;
}

.workspace-panels--dragging :deep(.splitpanes__pane) {
  transition: none;
}

.workspace-panels :deep(.splitpanes__splitter) {
  position: relative;
  z-index: 20;
  width: 1px;
  min-width: 1px;
  border-left: 1px solid var(--border);
  cursor: col-resize;
  opacity: 0.33;
  transition: opacity 200ms ease-out;
}

.workspace-panels :deep(.splitpanes__splitter::after) {
  position: absolute;
  inset-block: 0;
  left: -8px;
  width: 16px;
  content: "";
}

.workspace-panels :deep(.splitpanes__splitter:hover),
.workspace-panels :deep(.splitpanes__splitter:focus-visible) {
  opacity: 1;
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.workspace-panels--closed :deep(.splitpanes__splitter) {
  pointer-events: none;
  visibility: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .workspace-panels :deep(.splitpanes__pane),
  .workspace-panels :deep(.splitpanes__splitter) {
    transition: none;
  }
}

@media (max-width: 767px) {
  .workspace-panels__main-pane {
    width: 100% !important;
  }

  .workspace-panels :deep(.splitpanes__splitter) {
    display: none;
  }

  .workspace-panels__side-pane {
    width: 0 !important;
  }

  .workspace-panels__side-pane--visible {
    position: fixed !important;
    inset: 0;
    z-index: 50;
    width: 100% !important;
    background: var(--background);
  }
}
</style>
