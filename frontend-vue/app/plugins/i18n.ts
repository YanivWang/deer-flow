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
  const localeCookie = useCookie<string | null>("locale");
  locale.value = normalizeAppLocale(
    localeCookie.value ?? readWorkspacePreferences().appearance.locale,
  );

  const i18n = createI18n({
    fallbackLocale: DEFAULT_LOCALE,
    globalInjection: false,
    legacy: false,
    locale: locale.value,
    messages: i18nMessages as never,
  });

  watch(locale, (nextLocale) => {
    (i18n.global.locale as unknown as { value: AppLocale }).value = nextLocale;
  });

  nuxtApp.vueApp.use(i18n);
});
