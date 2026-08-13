<!--
  【文件职责】     以一个 splitpanes 组承载聊天区与 artifacts/sidecar/browser 共用右侧面板。
  【对应 frontend/】 frontend/src/components/workspace/chats/chat-box.tsx
  【架构位置】     L3 workspace layout
  【主要导出】     WorkspacePanels
  【依赖关系】     splitpanes；面板业务开关仍由 AgentChat 的唯一状态路径拥有
  【边界与注意】   使用 splitpanes 原生 width/keyboard/ARIA 行为；只在真实 release 后持久化或折叠。
-->

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Pane, Splitpanes, type SplitpanesResizedPayload } from "splitpanes";

const props = withDefaults(
  defineProps<{
    open: boolean;
    panelSize: number;
    panelLabel?: string;
  }>(),
  { panelLabel: "Conversation panel" },
);
const emit = defineEmits<{
  "update:panelSize": [value: number];
  collapse: [];
}>();

const MIN_OPEN_SIZE = 20;
const MAX_OPEN_SIZE = 72;
const COLLAPSE_THRESHOLD = 8;

const mainRegion = ref<HTMLElement | null>(null);
const panelRegion = ref<HTMLElement | null>(null);

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
  <div class="size-full min-h-0 min-w-0 overflow-hidden">
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
          :role="open ? 'dialog' : undefined"
          :aria-label="open ? panelLabel : undefined"
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
