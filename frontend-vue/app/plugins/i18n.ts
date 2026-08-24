/*
  【文件职责】     应用级 locale：统一 SSR/CSR 首屏状态与运行期切换（05 N4）。
  【架构位置】     L3
  【主要导出】     Nuxt plugin，provide `$i18n`
  【依赖关系】     core/i18n locale/cookie/translations · Nuxt provide
  【边界与注意】   **provide 的是 ref，不是快照（05 M1）。** 上游 React 版
                   `provide(ctx, { locale, setLocale, t })` 这个写法照搬过来
                   编译能过、运行不报错、切语言时**整个应用一个字都不变**——
                   `inject` 在 setup 期间一次性解析，拿到的是当时那个普通对象。
                   这里 `locale` 与 `t` 都是 ref/computed。

                   首屏状态只能由 Nuxt `useState` 序列化并在 hydration 两端复用。
                   SSR 请求直接从 cookie 派生；locale 个性化页面不得静态预渲染，
                   否则同一份 HTML 无法与不同用户 cookie 同时一致。CSR shell 先以
                   payload 默认值完成 hydration，再在 `app:mounted` 后消费浏览器
                   cookie/语言。禁止 hydration 前手动改写 DOM 或另建 client owner。
*/

import { computed } from "vue";

import { clientTranslations } from "@/core/i18n/client-translations";
import { parseLocaleCookie, setLocaleInCookie } from "@/core/i18n/cookies";
import { DEFAULT_LOCALE, detectLocale, type Locale } from "@/core/i18n/locale";

export default defineNuxtPlugin((nuxtApp) => {
  const requestLocale = import.meta.server
    ? parseLocaleCookie(useRequestHeaders(["cookie"]).cookie ?? "")
    : null;
  const locale = useState<Locale>(
    "deerflow-locale",
    () => requestLocale ?? DEFAULT_LOCALE,
  );
  const t = computed(() => clientTranslations[locale.value]);

  useHead(() => ({ htmlAttrs: { lang: locale.value } }));

  const setLocale = (next: Locale) => {
    locale.value = next;
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
    setLocaleInCookie(next);
  };

  nuxtApp.hook("app:mounted", () => {
    const cookieLocale = parseLocaleCookie(document.cookie);
    const next = cookieLocale ?? detectLocale();
    if (next !== locale.value || cookieLocale === null) setLocale(next);
    else document.documentElement.lang = next;
  });

  return {
    provide: {
      i18n: { locale, t, setLocale },
    },
  };
});
