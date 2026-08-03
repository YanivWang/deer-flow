<script setup lang="ts">
import type { SettingsSection } from "../../../entities/settings/model";

defineProps<{
  sections: readonly SettingsSection[];
  activeSection: SettingsSection;
  labels: Record<SettingsSection, string>;
}>();

const emit = defineEmits<{
  select: [section: SettingsSection];
}>();
</script>

<template>
  <nav class="settings-nav">
    <button
      v-for="section in sections"
      :key="section"
      class="settings-nav__item"
      :class="{ 'settings-nav__item--active': activeSection === section }"
      :data-testid="`vue-settings-nav-${section}`"
      type="button"
      @click="emit('select', section)"
    >
      {{ labels[section] }}
    </button>
  </nav>
</template>
