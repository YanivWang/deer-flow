/*
  【文件职责】     应用级 locale：读 cookie、提供词典与切换动作（05 N4）。
  【对应 frontend/】 core/i18n/context.tsx + core/i18n/hooks.ts
  【架构位置】     L3
  【主要导出】     Nuxt plugin，provide `$i18n`
  【依赖关系】     core/i18n locale/cookie/translations · Nuxt provide
  【边界与注意】   **provide 的是 ref，不是快照（05 M1）。** 上游 React 版
                   `provide(ctx, { locale, setLocale, t })` 这个写法照搬过来
                   编译能过、运行不报错、切语言时**整个应用一个字都不变**——
                   `inject` 在 setup 期间一次性解析，拿到的是当时那个普通对象。
                   这里 `locale` 与 `t` 都是 ref/computed。

                   cookie 读取放在 plugin 顶层同步执行，不是 `onMounted`；reactive
                   head 与手动同步共同防止 Nuxt hydration 把当前 `document.lang`
                   覆盖回默认值。CSR 产品路由在渲染产品文案前已完成 locale 派生。
*/

import { computed, ref } from "vue";

import { clientTranslations } from "@/core/i18n/client-translations";
import { getLocaleFromCookie, setLocaleInCookie } from "@/core/i18n/cookies";
import { DEFAULT_LOCALE, detectLocale, type Locale } from "@/core/i18n/locale";

export default defineNuxtPlugin(() => {
  const locale = ref<Locale>(
    getLocaleFromCookie() ??
      (import.meta.client ? detectLocale() : DEFAULT_LOCALE),
  );
  const t = computed(() => clientTranslations[locale.value]);

  useHead(() => ({ htmlAttrs: { lang: locale.value } }));

  if (typeof document !== "undefined") {
    document.documentElement.lang = locale.value;
  }

  const setLocale = (next: Locale) => {
    locale.value = next;
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
    setLocaleInCookie(next);
  };

  return {
    provide: {
      i18n: { locale, t, setLocale },
    },
  };
});
