<script setup lang="ts">
withDefaults(
  defineProps<{ tone?: "error" | "warning" | "success" | "info" | "loading"; message?: string | null }>(),
  { tone: "info", message: null },
);
</script>

<template>
  <div v-if="message || $slots.default" class="app-feedback" :class="`app-feedback--${tone}`" :role="tone === 'error' ? 'alert' : 'status'">
    <slot>{{ message }}</slot>
  </div>
</template>

<style scoped lang="scss">
.app-feedback {
  padding: var(--df-space-3);
  border: 1px solid;
  border-radius: var(--df-radius-md);
}

.app-feedback--error {
  color: var(--df-color-error);
  background: var(--df-color-error-bg);
  border-color: var(--df-color-error);
}

.app-feedback--warning {
  color: var(--df-color-warning);
  background: var(--df-color-warning-bg);
  border-color: var(--df-color-warning);
}

.app-feedback--success {
  color: var(--df-color-success);
  background: var(--df-color-success-bg);
  border-color: var(--df-color-success);
}

.app-feedback--info, .app-feedback--loading {
  color: var(--df-color-info);
  background: var(--df-color-info-bg);
  border-color: var(--df-color-info);
}
</style>
