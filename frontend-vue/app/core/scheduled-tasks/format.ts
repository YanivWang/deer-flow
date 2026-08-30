/*
  【文件职责】     Scheduled-task 时间戳的显示格式。
  【架构位置】     L3 pure formatting
  【主要导出】     SCHEDULED_TASK_NONE · formatScheduledTaskTimestamp
  【依赖关系】     Intl
  【边界与注意】   固定的 numeric/2-digit 字段，不是 dateStyle/timeStyle 预设：
                   同一个时刻在 `medium` 预设下是「Jul 2, 2026, 1:00:00 AM」，在这里是
                   「07/02/2026, 01:00 AM」。next_run_at 是**将来**的时刻，所以一律绝对
                   时间，不走相对措辞。
*/

export const SCHEDULED_TASK_NONE = "—";

export function formatScheduledTaskTimestamp(
  value: string | null,
  locale: string,
): string {
  if (!value) return SCHEDULED_TASK_NONE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const intlLocale = locale === "zh-CN" ? "zh-CN" : "en-US";
  return new Intl.DateTimeFormat(intlLocale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
