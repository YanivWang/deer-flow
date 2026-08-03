<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(defineProps<{ open?: boolean; title?: string; closeLabel?: string }>(), {
  open: false,
  title: "对话框",
  closeLabel: "关闭",
});
const emit = defineEmits<{ close: [] }>();
const panel = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusFirstControl(): void {
  const firstControl = panel.value?.querySelector<HTMLElement>(focusableSelector);
  (firstControl ?? panel.value)?.focus();
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
    return;
  }
  if (event.key !== "Tab" || !panel.value) return;
  const focusable = [...panel.value.querySelectorAll<HTMLElement>(focusableSelector)];
  if (focusable.length === 0) {
    event.preventDefault();
    panel.value.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function stopDialogInteraction(): void {
  window.removeEventListener("keydown", handleKeydown);
  previouslyFocused?.focus();
  previouslyFocused = null;
}

async function startDialogInteraction(): Promise<void> {
  previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  await nextTick();
  focusFirstControl();
  window.addEventListener("keydown", handleKeydown);
}

watch(() => props.open, (open) => {
  if (open) void startDialogInteraction();
  else stopDialogInteraction();
}, { immediate: true });
onBeforeUnmount(stopDialogInteraction);
</script>

<template>
  <div v-if="open" class="app-dialog" role="dialog" aria-modal="true" :aria-label="title">
    <div class="app-dialog__backdrop" @click.self="emit('close')" />
    <section ref="panel" class="app-dialog__panel" tabindex="-1">
      <header class="app-dialog__header"><h2>{{ title }}</h2><button type="button" :aria-label="closeLabel" @click="emit('close')">×</button></header>
      <div class="app-dialog__body"><slot /></div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.app-dialog {
  position: fixed;
  z-index: var(--df-z-modal);
  inset: 0;
  display: grid;
  place-items: center;
}

.app-dialog__backdrop {
  position: absolute;
  inset: 0;
  background: var(--df-color-overlay);
}

.app-dialog__panel {
  position: relative;
  width: min(36rem, calc(100vw - 2 * var(--df-space-4)));
  max-height: calc(100vh - 2 * var(--df-space-4));
  overflow: auto;
  background: var(--df-color-bg-elevated);
  border-radius: var(--df-radius-lg);
  box-shadow: var(--df-shadow-lg);
}

.app-dialog__header {
  display: flex;
  justify-content: space-between;
  gap: var(--df-space-4);
  padding: var(--df-space-4);
  border-bottom: 1px solid var(--df-color-border);
}

.app-dialog__header h2 {
  margin: 0;
  font-size: var(--df-font-size-lg);
}

.app-dialog__header button {
  color: var(--df-color-text-secondary);
  font-size: var(--df-font-size-xl);
  background: transparent;
  border: 0;
  cursor: pointer;
}
.app-dialog__body { padding: var(--df-space-4); }
</style>
