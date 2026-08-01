import { watch } from "vue";
import { createI18n } from "vue-i18n";

import {
  DEFAULT_LOCALE,
  i18nMessages,
  normalizeAppLocale,
  type AppLocale,
} from "../core/i18n";
import { readWorkspacePreferences } from "../core/settings/preferences";

export default defineNuxtPlugin((nuxtApp) => {
  const locale = useState<AppLocale>("locale", () => DEFAULT_LOCALE);
  locale.value = normalizeAppLocale(readWorkspacePreferences().appearance.locale);

  const i18n = createI18n({
    fallbackLocale: DEFAULT_LOCALE,
    globalInjection: false,
    legacy: false,
    locale: locale.value,
    messages: i18nMessages,
  });

  watch(locale, (nextLocale) => {
    i18n.global.locale.value = nextLocale;
  });

  nuxtApp.vueApp.use(i18n);
});
