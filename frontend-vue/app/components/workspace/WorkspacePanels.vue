<!--
  【文件职责】     以一个 splitpanes 组承载聊天区与 artifacts/sidecar/browser 共用右侧面板。
  【架构位置】     L3 workspace layout
  【主要导出】     WorkspacePanels
  【依赖关系】     splitpanes；面板业务开关仍由 AgentChat 的唯一状态路径拥有
  【边界与注意】   使用 splitpanes 原生 width/keyboard/ARIA 行为；只在真实 release 后持久化或折叠。
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
import { Pane, Splitpanes, type SplitpanesResizedPayload } from "splitpanes";

const props = defineProps<{
  open: boolean;
  panelSize: number;
  panelLabel?: string;
}>();
const emit = defineEmits<{
  "update:panelSize": [value: number];
  collapse: [];
}>();

const MIN_OPEN_SIZE = 20;
const MAX_OPEN_SIZE = 72;
const COLLAPSE_THRESHOLD = 8;

const root = ref<HTMLElement | null>(null);
const mainRegion = ref<HTMLElement | null>(null);
const panelRegion = ref<HTMLElement | null>(null);

/*
  地标还是对话框，取决于断点。

  React 用两套实现：宽屏是 `<aside id="artifacts">`，**没有 role**，所以读屏器
  听到的是一个 complementary 地标，聊天区依然可达；窄屏才换成 Sheet，也就是一个
  真的模态 dialog（frontend/src/components/workspace/chats/chat-box.tsx 的
  `if (isMobile)` 分支）。两边给的语义不同不是疏忽——宽屏面板是并排的第二栏，
  把它报成 dialog 等于告诉用户「其余内容现在不可用」，而它明明可用。

  断点用 JS 判定而不是只靠 CSS：role 是属性不是样式，媒体查询改不了它。
  SSR 阶段当作宽屏，与 React 的 useIsMobile 在服务端按桌面渲染一致。
*/
const NARROW_QUERY = "(max-width: 767px)";
const isNarrow = ref(false);
let narrowMedia: MediaQueryList | null = null;
function syncNarrow(event: MediaQueryList | MediaQueryListEvent) {
  isNarrow.value = event.matches;
}
const asDialog = computed(() => props.open && isNarrow.value);

const sideSize = computed(() =>
  props.open ? clampOpenSize(props.panelSize) : 0,
);
const mainSize = computed(() => 100 - sideSize.value);

function clampOpenSize(value: number) {
  return Math.max(MIN_OPEN_SIZE, Math.min(MAX_OPEN_SIZE, value));
}

function sidePaneSize(payload: { panes: { size: number }[] }) {
  return payload.panes[1]?.size ?? 0;
}

function onResized(payload: SplitpanesResizedPayload) {
  // Registration and prop changes also emit `resized`; only a user event owns
  // a new persisted size or a collapse decision.
  if (!payload.event) return;
  const finalSize = sidePaneSize(payload);
  if (finalSize < COLLAPSE_THRESHOLD) emit("collapse");
  else emit("update:panelSize", clampOpenSize(finalSize));
}

/*
  splitpanes 是在挂载后用 createElement 直接插入 splitter 的，模板上没有它，
  aria-disabled 只能在这里补。React 那边由 react-resizable-panels 自己写
  （dist 里的 `"aria-disabled": n || void 0`），语义一致：关着的分隔线是 disabled，
  不是消失。
*/
function syncSplitterDisabled() {
  const splitter = root.value?.querySelector(".splitpanes__splitter");
  if (!splitter) return;
  if (props.open) splitter.removeAttribute("aria-disabled");
  else splitter.setAttribute("aria-disabled", "true");
}
onMounted(async () => {
  narrowMedia = globalThis.matchMedia?.(NARROW_QUERY) ?? null;
  if (narrowMedia) {
    syncNarrow(narrowMedia);
    narrowMedia.addEventListener("change", syncNarrow);
  }
  await nextTick();
  syncSplitterDisabled();
});
onBeforeUnmount(() => {
  narrowMedia?.removeEventListener("change", syncNarrow);
});
watch(() => props.open, syncSplitterDisabled, { flush: "post" });

watch(
  () => props.open,
  async (open) => {
    if (open) return;
    const active = document.activeElement;
    if (
      !(active instanceof HTMLElement) ||
      !panelRegion.value?.contains(active)
    ) {
      return;
    }
    await nextTick();
    mainRegion.value?.focus({ preventScroll: true });
  },
);
</script>

<template>
  <div ref="root" class="size-full min-h-0 min-w-0 overflow-hidden">
    <Splitpanes
      class="workspace-panels size-full min-h-0 min-w-0"
      :class="{ 'workspace-panels--closed': !open }"
      :push-other-panes="false"
      :maximize-panes="false"
      :keyboard-step="2"
      @resized="onResized"
    >
      <Pane :size="mainSize" min-size="28" class="workspace-panels__main-pane">
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
        class="workspace-panels__side-pane"
        :class="{ 'workspace-panels__side-pane--visible': open }"
      >
        <aside
          ref="panelRegion"
          :role="asDialog ? 'dialog' : undefined"
          :aria-label="asDialog ? panelLabel : undefined"
          :aria-hidden="!open"
          :inert="!open"
          class="size-full min-h-0 min-w-0 overflow-hidden"
          :class="open ? '' : 'pointer-events-none'"
          @keydown.esc="emit('collapse')"
        >
          <div
            v-show="open"
            class="ml-auto h-full min-w-0 overflow-hidden md:min-w-[20rem]"
          >
            <slot name="panel" />
          </div>
        </aside>
      </Pane>
    </Splitpanes>
  </div>
</template>

<style scoped>
.workspace-panels :deep(.splitpanes__pane) {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.workspace-panels :deep(.splitpanes__splitter) {
  position: relative;
  z-index: 20;
  width: 1px;
  min-width: 1px;
  border-left: 1px solid var(--border);
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

/*
  关着的时候只是**看不见**，不是不存在：React 的 ResizableHandle 在右侧面板关闭时
  传 disabled，元素照样留在树里，读屏器听到的是一个 disabled 的 separator
  （frontend/src/components/workspace/chats/chat-box.tsx）。visibility: hidden 会把它
  整个从可访问性树里摘掉，于是「这里有一条可以拖的分隔线、现在不能拖」这句话没人说得出来。
*/
.workspace-panels--closed :deep(.splitpanes__splitter) {
  pointer-events: none;
  opacity: 0;
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
