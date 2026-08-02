<script setup lang="ts">
import { theme as antdTheme } from "ant-design-vue";

import { getAntdLocale, getHtmlLang } from "../config/antd-locale";
import { getAntdThemeToken, type ThemeMode } from "../config/theme";
import { DEFAULT_LOCALE, normalizeAppLocale } from "./core/i18n";
import {
  applyThemePreference,
  readWorkspacePreferences,
  type LocalePreference,
} from "./core/settings/preferences";

const mode = useState<ThemeMode>("theme-mode", () => "light");
const locale = useState<LocalePreference>("locale", () => DEFAULT_LOCALE);
const localeCookie = useCookie<string | null>("locale");

const antdConfig = computed(() => ({
  algorithm: mode.value === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: getAntdThemeToken(mode.value),
}));

onMounted(() => {
  const preferences = readWorkspacePreferences();
  mode.value = applyThemePreference(preferences.appearance.theme);
  locale.value = normalizeAppLocale(localeCookie.value ?? preferences.appearance.locale);
});

useHead({
  htmlAttrs: {
    "data-theme": mode,
    lang: computed(() => getHtmlLang(locale.value)),
  },
  script: [
    {
      innerHTML:
        "try{var p=JSON.parse(localStorage.getItem('deerflow.vue.workspace-preferences')||'{}').appearance||{};var t=p.theme==='dark'||p.theme==='light'?p.theme:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}",
      tagPosition: "head",
    },
  ],
});
</script>

<template>
  <a-config-provider :theme="antdConfig" :locale="getAntdLocale(locale)">
    <NuxtPage />
  </a-config-provider>
</template>
