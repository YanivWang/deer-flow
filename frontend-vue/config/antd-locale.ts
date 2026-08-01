import enUS from "ant-design-vue/es/locale/en_US";
import zhCN from "ant-design-vue/es/locale/zh_CN";

import { getHtmlLang, type AppLocale } from "../app/core/i18n";

export type DeerFlowLocale = AppLocale;

export function getAntdLocale(locale: DeerFlowLocale) {
  return locale === "zh-CN" ? zhCN : enUS;
}

export { getHtmlLang };
