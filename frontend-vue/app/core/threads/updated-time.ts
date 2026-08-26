/*
  【文件职责】     将 Gateway updated_at 转成 locale-aware 相对时间。
  【架构位置】     L3 thread presentation
  【主要导出】     formatThreadUpdatedTime
  【依赖关系】     date-fns
  【边界与注意】   措辞必须逐字等于 React 的 formatTimeAgo
                   （frontend/src/core/utils/datetime.ts），所以这里用的是**同一个库**
                   date-fns，而不是 Intl.RelativeTimeFormat。

                   原来用 Intl.RelativeTimeFormat 自己分桶，输出是「last year」；
                   date-fns 的 formatDistanceToNow 输出「about 1 year ago」。两者
                   都合法，但会话列表里两个应用念出来的不是同一句话，而这份对照的
                   判据就是可访问名逐字相同。想靠词典把 16 个 date-fns 分桶
                   （lessThanXSeconds … overXYears）在两种语言上重写一遍，等于把
                   一份会随上游演进的语料抄进本仓，抄错了没有任何门禁会发现。

                   非法时间返回 "-"，与 React 一致（React 的注释写的是后端可能返回
                   空 lastUpdated，new Date("") 会让 date-fns 抛 Invalid time value）。
                   缺失时间返回 null：调用方据此决定**渲染不渲染**这一行——React 那边
                   是 `thread.updated_at && (...)`，没有时间就整块不出现。
*/
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";

function dateFnsLocale(locale: string | undefined) {
  return locale === "zh-CN" ? zhCN : enUS;
}

export function formatThreadUpdatedTime(
  value: string | number | Date | null | undefined,
  locale?: string,
) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: dateFnsLocale(locale),
  });
}
