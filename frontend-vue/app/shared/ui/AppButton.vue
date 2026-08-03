<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "default" | "primary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
    loading?: boolean;
    disabled?: boolean;
    htmlType?: "button" | "submit" | "reset";
    ariaLabel?: string;
  }>(),
  {
    variant: "default",
    size: "md",
    loading: false,
    disabled: false,
    htmlType: "button",
    ariaLabel: undefined,
  },
);

const classes = computed(() => [
  "app-button",
  `app-button--${props.variant}`,
  `app-button--${props.size}`,
  { "app-button--loading": props.loading },
]);
</script>

<template>
  <button
    v-bind="$attrs"
    :aria-label="ariaLabel"
    :class="classes"
    :disabled="disabled || loading"
    :type="htmlType"
  >
    <span v-if="loading" class="app-button__spinner" aria-hidden="true">⟳</span>
    <span><slot /></span>
  </button>
</template>

<style scoped lang="scss">
.app-button {
  display: inline-flex;
  gap: var(--df-space-2);
  align-items: center;
  justify-content: center;
  min-height: var(--df-control-height-md);
  padding: 0 var(--df-space-3);
  color: var(--df-color-text);
  font: inherit;
  line-height: 1;
  cursor: pointer;
  background: var(--df-color-bg-container);
  border: 1px solid var(--df-color-border);
  border-radius: var(--df-radius-md);
  transition: color var(--df-motion-fast) var(--df-ease-standard),
    background var(--df-motion-fast) var(--df-ease-standard),
    border-color var(--df-motion-fast) var(--df-ease-standard);

  &:focus-visible {
    outline: var(--df-ring-width) solid var(--df-ring-color);
    outline-offset: var(--df-focus-outline-offset);
  }

  &:disabled {
    color: var(--df-disabled-text);
    cursor: not-allowed;
    background: var(--df-disabled-bg);
    border-color: var(--df-disabled-border);
  }
}

.app-button--sm {
  min-height: var(--df-control-height-sm);
  padding-inline: var(--df-space-2);
  font-size: var(--df-font-size-sm);
}

.app-button--lg {
  min-height: var(--df-control-height-lg);
  padding-inline: var(--df-space-4);
}

.app-button--primary {
  color: var(--df-color-bg-container);
  background: var(--df-color-primary);
  border-color: var(--df-color-primary);
}

.app-button--ghost {
  background: transparent;
}

.app-button--danger {
  color: var(--df-color-error);
  border-color: var(--df-color-error);
}

.app-button__spinner {
  animation: app-button-spin 0.8s linear infinite;
}

@keyframes app-button-spin {
  to { transform: rotate(360deg); }
}
</style>
