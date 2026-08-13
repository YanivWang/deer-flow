<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{
  open: boolean;
  panelSize: number;
  animate?: boolean;
  panelLabel?: string;
}>();
const emit = defineEmits<{
  "update:panelSize": [value: number];
  collapse: [];
}>();

const group = ref<HTMLElement | null>(null);
const dragging = ref(false);
const hovering = ref(false);
const animating = ref(false);
const dragSize = ref<number | null>(null);
let animationTimer: ReturnType<typeof setTimeout> | undefined;

const effectiveSize = computed(() => {
  if (!props.open) return 0;
  return dragSize.value ?? Math.max(20, Math.min(72, props.panelSize));
});
const mainGrow = computed(() => Math.max(0, 100 - effectiveSize.value));
const panelGrow = computed(() => effectiveSize.value);
const separatorState = computed(() =>
  !props.open
    ? "disabled"
    : dragging.value
      ? "active"
      : hovering.value
        ? "hover"
        : "inactive",
);

watch(
  () => props.open,
  async () => {
    if (!props.animate) {
      animating.value = false;
      return;
    }
    animating.value = true;
    await nextTick();
    clearTimeout(animationTimer);
    animationTimer = setTimeout(() => {
      animating.value = false;
    }, 240);
  },
);

function sizeFromPointer(clientX: number) {
  const bounds = group.value?.getBoundingClientRect();
  if (!bounds || bounds.width <= 0) return props.panelSize;
  return Math.max(
    0,
    Math.min(80, ((bounds.right - clientX) / bounds.width) * 100),
  );
}
function onMove(event: MouseEvent) {
  if (!dragging.value) return;
  dragSize.value = sizeFromPointer(event.clientX);
}
function finishDrag() {
  if (!dragging.value) return;
  const finalSize = dragSize.value ?? props.panelSize;
  dragging.value = false;
  dragSize.value = null;
  globalThis.removeEventListener("mousemove", onMove);
  globalThis.removeEventListener("mouseup", finishDrag);
  if (finalSize < 8) {
    emit("collapse");
  } else {
    emit("update:panelSize", Math.max(20, Math.min(72, finalSize)));
  }
}
function startDrag(event: MouseEvent) {
  if (!props.open) return;
  event.preventDefault();
  dragging.value = true;
  animating.value = false;
  dragSize.value = sizeFromPointer(event.clientX);
  globalThis.addEventListener("mousemove", onMove);
  globalThis.addEventListener("mouseup", finishDrag);
}
onBeforeUnmount(() => {
  clearTimeout(animationTimer);
  globalThis.removeEventListener("mousemove", onMove);
  globalThis.removeEventListener("mouseup", finishDrag);
});
</script>

<template>
  <div
    ref="group"
    data-slot="resizable-panel-group"
    class="flex size-full min-h-0 min-w-0 overflow-hidden"
  >
    <div
      data-panel
      class="relative min-h-0 min-w-0 basis-0 overflow-hidden"
      :class="
        props.animate && animating && !dragging
          ? 'transition-[flex-grow] duration-200'
          : ''
      "
      :style="{ flexGrow: mainGrow }"
    >
      <slot name="main" />
    </div>
    <div
      data-slot="resizable-handle"
      :data-separator="separatorState"
      role="separator"
      aria-orientation="vertical"
      class="border-border hover:border-primary relative z-20 w-px shrink-0 cursor-col-resize border-l after:absolute after:inset-y-0 after:-left-2 after:w-4"
      :class="!open ? 'pointer-events-none invisible' : ''"
      @mouseenter="hovering = true"
      @mouseleave="hovering = false"
      @mousedown="startDrag"
    />
    <div
      data-panel
      :role="open ? 'dialog' : undefined"
      :aria-label="open ? panelLabel : undefined"
      class="min-h-0 min-w-0 basis-0 overflow-hidden"
      :class="[
        open
          ? 'max-md:bg-background max-md:fixed max-md:inset-0 max-md:z-50'
          : '',
        props.animate && animating && !dragging
          ? 'transition-[flex-grow] duration-200'
          : '',
      ]"
      :style="{ flexGrow: panelGrow }"
    >
      <div
        v-show="open"
        class="size-full min-w-0 overflow-hidden md:min-w-[20rem]"
      >
        <slot name="panel" />
      </div>
    </div>
  </div>
</template>
