<script setup lang="ts">
import type { SettingsPreferencesController } from "../../../features/settings/preferences/use-settings-preferences";

const props = defineProps<{
  preferences: SettingsPreferencesController;
}>();

function updateLocale(event: Event) {
  props.preferences.setLocale(event.target instanceof HTMLSelectElement ? event.target.value : "");
}
</script>

<template>
  <h2>外观</h2>
  <p>主题和语言偏好会保存在当前浏览器本地。</p>
  <div class="settings-card-grid" role="group">
    <button
      v-for="theme in preferences.themeOptions"
      :key="theme"
      class="settings-choice"
      :class="{ 'settings-choice--active': preferences.preferences.value.appearance.theme === theme }"
      :data-testid="`vue-settings-theme-${theme}`"
      type="button"
      @click="preferences.updateTheme(theme)"
    >
      <strong>{{ theme === "system" ? "跟随系统" : theme === "light" ? "浅色" : "深色" }}</strong>
      <span v-if="theme === 'system'">跟随操作系统。</span>
      <span v-else>使用{{ theme === "light" ? "浅色" : "深色" }}配色。</span>
    </button>
  </div>
  <p data-testid="vue-settings-resolved-theme">
    当前主题：{{ preferences.resolvedTheme.value === "light" ? "浅色" : "深色" }}
  </p>
  <label class="workspace-field settings-field">
    <span>语言</span>
    <select
      data-testid="vue-settings-locale"
      :value="preferences.preferences.value.appearance.locale"
      @change="updateLocale"
    >
      <option v-for="locale in preferences.localeOptions" :key="locale.value" :value="locale.value">
        {{ locale.label }}
      </option>
    </select>
  </label>
</template>
