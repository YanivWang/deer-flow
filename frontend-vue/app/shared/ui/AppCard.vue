<script setup lang="ts">
withDefaults(
  defineProps<{
    selected?: boolean;
    interactive?: boolean;
    tag?: "article" | "div" | "section";
  }>(),
  { selected: false, interactive: false, tag: "section" },
);
</script>

<template>
  <component
    :is="tag"
    class="app-card"
    :class="{ 'app-card--selected': selected, 'app-card--interactive': interactive }"
  >
    <slot />
  </component>
</template>

<style scoped lang="scss">
.app-card {
  padding: var(--df-space-4);
  background: var(--df-color-bg-container);
  border: 1px solid var(--df-color-border);
  border-radius: var(--df-radius-lg);
}

.app-card--selected {
  border-color: var(--df-color-primary);
  box-shadow: var(--df-shadow-focus);
}
.app-card--interactive { cursor: pointer; }
</style>
