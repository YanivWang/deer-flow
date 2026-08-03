<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    description?: string;
    error?: string | null;
    required?: boolean;
    forId?: string;
  }>(),
  { description: undefined, error: null, required: false, forId: undefined },
);
</script>

<template>
  <label class="app-form-field" :for="forId">
    <span class="app-form-field__label">
      {{ label }}<span v-if="required" aria-hidden="true"> *</span>
    </span>
    <span v-if="description" class="app-form-field__description">{{ description }}</span>
    <span><slot /></span>
    <span v-if="error" class="app-form-field__error" role="alert">{{ error }}</span>
  </label>
</template>

<style scoped lang="scss">
.app-form-field {
  display: grid;
  gap: var(--df-space-2);
  color: var(--df-color-text);
}

.app-form-field__label { font-weight: var(--df-font-weight-semibold); }

.app-form-field__description {
  color: var(--df-color-text-secondary);
  font-size: var(--df-font-size-sm);
}

.app-form-field__error {
  color: var(--df-color-error);
  font-size: var(--df-font-size-sm);
}
</style>
