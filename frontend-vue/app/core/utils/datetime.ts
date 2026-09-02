/*
  【文件职责】     把时间戳转成与 React 逐字相同的 locale-aware 相对时间。
  【架构位置】     L3
  【主要导出】     formatTimeAgo
  【依赖关系】     date-fns
  【边界与注意】   与 React 的 `formatTimeAgo`（frontend/src/core/utils/datetime.ts）
                   同措辞，所以用的是**同一个库** date-fns 而不是
                   Intl.RelativeTimeFormat——后者输出「last year」，前者输出
                   「about 1 year ago」，两者都合法但不是同一句话，而这份对照的判据
                   就是可访问名逐字相同。想靠词典把 16 个 date-fns 分桶在两种语言上
                   重写一遍，等于把一份会随上游演进的语料抄进本仓。

                   **非法与空时间都返回 `"-"`**，与 React 一致（React 的注释写着
                   后端可能给出空的 lastUpdated，`new Date("")` 会让 date-fns 抛
                   Invalid time value）。「缺时间就整块不渲染」是**调用方**的判断，
                   不是这里的——会话列表要那个语义，用 threads/updated-time 的
                   `formatThreadUpdatedTime`。
*/

import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";

export function dateFnsLocale(locale: string | undefined) {
  return locale === "zh-CN" ? zhCN : enUS;
}

export function formatTimeAgo(
  value: string | number | Date | null | undefined,
  locale?: string,
): string {
  const date = value instanceof Date ? value : new Date(value ?? "");
  if (Number.isNaN(date.getTime())) return "-";
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: dateFnsLocale(locale),
  });
}
