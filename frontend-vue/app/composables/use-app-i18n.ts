import {
  translateI18nMessage,
  type AppLocale,
  type I18nMessageKey,
} from "../core/i18n";

export function useAppI18n() {
  const locale = useState<AppLocale>("locale");

  function t(key: I18nMessageKey, values: Readonly<Record<string, string | number>> = {}) {
    return translateI18nMessage(key, locale.value, values);
  }

  return { locale, t };
}
