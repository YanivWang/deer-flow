<script setup lang="ts">
/*
  【文件职责】     管理 DeerFlow locale、theme 与显示偏好。
  【架构位置】     L3
  【主要导出】     默认 AppearanceSettings 组件
  【依赖关系】     i18n · color mode · settings store
  【边界与注意】   应用设置接线，不属于 L2。
*/
import SettingsSection from "./SettingsSection.vue";
import type { Locale } from "@/core/i18n/locale";
import { enUS } from "@/core/i18n/locales/en-US";
import { zhCN } from "@/core/i18n/locales/zh-CN";
import { computed } from "vue";

const { $i18n, $theme } = useNuxtApp();
const themeOptions = computed(() => [
  {
    value: "system" as const,
    label: $i18n.t.value.settings.appearance.system,
    description: $i18n.t.value.settings.appearance.systemDescription,
  },
  {
    value: "light" as const,
    label: $i18n.t.value.settings.appearance.light,
    description: $i18n.t.value.settings.appearance.lightDescription,
  },
  {
    value: "dark" as const,
    label: $i18n.t.value.settings.appearance.dark,
    description: $i18n.t.value.settings.appearance.darkDescription,
  },
]);

function setLocale(event: Event) {
  $i18n.setLocale((event.target as HTMLSelectElement).value as Locale);
}
</script>

<template>
  <div class="space-y-8">
    <SettingsSection
      :title="$i18n.t.value.settings.appearance.themeTitle"
      :description="$i18n.t.value.settings.appearance.themeDescription"
    >
      <div class="grid gap-3 sm:grid-cols-3">
        <button
          v-for="option in themeOptions"
          :key="option.value"
          :data-theme-preference="option.value"
          type="button"
          class="rounded-lg border p-4 text-left capitalize"
          :class="
            $theme.preference.value === option.value
              ? 'border-primary ring-primary/30 ring-2'
              : ''
          "
          @click="$theme.setPreference(option.value)"
        >
          <span>{{ option.label }}</span>
          <span class="text-muted-foreground mt-1 block text-xs normal-case">
            {{ option.description }}
          </span>
        </button>
      </div>
    </SettingsSection>

    <SettingsSection
      :title="$i18n.t.value.settings.appearance.languageTitle"
      :description="$i18n.t.value.settings.appearance.languageDescription"
    >
      <select
        :value="$i18n.locale.value"
        class="border-input rounded-md border px-3 py-2"
        @change="setLocale"
      >
        <option value="en-US">{{ enUS.locale.localName }}</option>
        <option value="zh-CN">{{ zhCN.locale.localName }}</option>
      </select>
    </SettingsSection>
  </div>
</template>
