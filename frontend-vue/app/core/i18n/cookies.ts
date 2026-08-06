/*
  【文件职责】     locale cookie 的读写（05 N4）。
  【对应 frontend/】 core/i18n/cookies.ts（REWRITE：上游第三个函数 import next/headers）
  【架构位置】     L3
  【主要导出】     LOCALE_COOKIE_NAME · LOCALE_COOKIE_MAX_AGE_SECONDS
                   parseLocaleCookie · serializeLocaleCookie
                   getLocaleFromCookie · setLocaleInCookie
  【依赖关系】     ./locale
  【边界与注意】   **N4 的登记在本文件填完**（05 N 组的验收动作是「补齐这一格并把
                   结论写回 05」，不是跑通某个断言）。实测三条：

                   1. cookie 名 `locale`、有效期 1 年、`path=/`、`SameSite=Lax`
                      —— 与上游逐字一致，**因为它是既有用户的持久化格式**。
                      改名会让所有老用户的语言偏好一次性丢失。
                   2. 上游的 `getLocaleFromCookieServer()`（`next/headers`）**不迁**。
                      Vue 版没有服务端 locale 派生这一层，所以有了第 3 条。
                   3. ⚠️ **首帧闪烁是真实存在的代价，不是可以补测掉的。**
                      Next 版在服务端读 cookie、直接把正确语言渲进 HTML；
                      `ssr:false` 的路由下没有这一步，首帧只能是默认语言，
                      hydrate 之后才切。03 说「i18n 双词典分裂随之消失」时没算这笔。
                      本窗口**没有解决它**，只把它变成显式的：plugin 在
                      `app:created` 就同步读 cookie 并 set，把窗口压到最小；
                      预渲染路由（prerenderRoutes）上仍然会看得见。

                   读写拆成 `parse`/`serialize` 两个纯函数，是因为「不可信输入」
                   的形状在这里也成立：cookie 值来自浏览器，任何字符串都可能。
                   `parseLocaleCookie` 返回 `Locale | null`，非法值一律 null。
*/

import { isLocale, type Locale } from "./locale";

export const LOCALE_COOKIE_NAME = "locale";
/** 1 年，与上游逐字一致。 */
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** 从整串 `document.cookie` 里取出合法 locale；取不到或非法都返回 null。 */
export function parseLocaleCookie(cookieHeader: string): Locale | null {
  for (const cookie of cookieHeader.split(";")) {
    const trimmed = cookie.trim();
    const at = trimmed.indexOf("=");
    if (at === -1) continue;
    if (trimmed.slice(0, at) !== LOCALE_COOKIE_NAME) continue;
    let value: string;
    try {
      value = decodeURIComponent(trimmed.slice(at + 1));
    } catch {
      // `%` 后面跟着非十六进制会让 decodeURIComponent 抛。cookie 是不可信输入，
      // 抛出去会让整个 plugin 初始化失败——一个坏 cookie 不该让应用打不开。
      return null;
    }
    return isLocale(value) ? value : null;
  }
  return null;
}

export function serializeLocaleCookie(locale: Locale): string {
  return `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; path=/; SameSite=Lax`;
}

export function getLocaleFromCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  return parseLocaleCookie(document.cookie);
}

export function setLocaleInCookie(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.cookie = serializeLocaleCookie(locale);
}
