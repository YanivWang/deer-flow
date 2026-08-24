/*
  【文件职责】     将 Gateway updated_at 转成 locale-aware 相对时间。
  【架构位置】     L3 thread presentation
  【主要导出】     formatThreadUpdatedTime
  【依赖关系】     Intl.RelativeTimeFormat
  【边界与注意】   缺失/非法时间返回 null；计算使用绝对时间戳，不依赖显示时区。
*/
export function formatThreadUpdatedTime(
  value: string | number | Date | null | undefined,
  now = new Date(),
  locale?: string,
) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(now.getTime())) {
    return null;
  }
  const seconds = (date.getTime() - now.getTime()) / 1_000;
  const absoluteSeconds = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (absoluteSeconds < 60)
    return formatter.format(Math.round(seconds), "second");
  if (absoluteSeconds < 3_600)
    return formatter.format(Math.round(seconds / 60), "minute");
  if (absoluteSeconds < 86_400)
    return formatter.format(Math.round(seconds / 3_600), "hour");
  if (absoluteSeconds < 2_592_000)
    return formatter.format(Math.round(seconds / 86_400), "day");
  if (absoluteSeconds < 31_536_000)
    return formatter.format(Math.round(seconds / 2_592_000), "month");
  return formatter.format(Math.round(seconds / 31_536_000), "year");
}
