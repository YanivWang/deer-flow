/*
  【文件职责】     承载定时任务的 schedule 取值类型与时区候选，供组件与 recipes 共用。
  【架构位置】     L3 类型与纯逻辑
  【主要导出】     ScheduleValue · detectBrowserTimezone · timezoneOptions
  【依赖关系】     零依赖；被 recipes.ts 与 ScheduledTaskScheduleInput.vue 引用
  【边界与注意】   06 §M1 1b 里 `retype-component-type` 那一条就是这个文件的由来：
                   上游把 `ScheduleValue` 定义在 React 组件文件里，core 反过来 import 组件，
                   方向是反的。类型搬进 core 之后依赖方向才对——组件依赖 core，不是反过来。

                   `timezoneOptions()` 原样照抄 React 的两段式取值。**没有**把
                   `detectBrowserTimezone()` 的结果补进候选：Chromium 的
                   `Intl.supportedValuesOf("timeZone")` 有 418 个区，但**不含 "UTC"**
                   （实测），而 `resolvedOptions().timeZone` 在 TZ=UTC 的机器上恰好返回
                   "UTC"。于是 React 的时区 Select 在这种机器上选中了一个不在选项里的值，
                   触发器显示为空——对照取样里 React 侧那个没有可访问名、也没有值的
                   `combobox` 就是它。补一条候选能让 Vue 显示 "UTC"，但那样两个应用的
                   选项集合就不一样了。这是 React 的缺陷，按边界不在本仓修。
*/

export type ScheduleValue = {
  schedule_type: "once" | "cron";
  schedule_spec: { cron?: string; run_at?: string };
  timezone: string;
};

/** `Intl.supportedValuesOf` 不可用时的候选，与 React 同一份。 */
const FALLBACK_TIMEZONES = [
  "UTC",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
];

export function detectBrowserTimezone(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof timezone === "string" && timezone.length > 0) {
      return timezone;
    }
  } catch {
    // resolvedOptions 不可用
  }
  return "UTC";
}

export function timezoneOptions(): string[] {
  const supported = (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: string) => string[] | undefined;
    }
  ).supportedValuesOf?.("timeZone");
  if (Array.isArray(supported) && supported.length > 0) {
    return supported;
  }
  return FALLBACK_TIMEZONES;
}
