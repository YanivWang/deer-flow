/*
  【文件职责】     承载定时任务的 schedule 取值类型与时区候选，供组件与 recipes 共用。
  【架构位置】     L3 类型与纯逻辑
  【主要导出】     ScheduleValue · detectBrowserTimezone · timezoneOptions
  【依赖关系】     零依赖；被 recipes.ts 与 ScheduledTaskScheduleInput.vue 引用
  【边界与注意】   06 §M1 1b 里 `retype-component-type` 那一条就是这个文件的由来：
                   上游把 `ScheduleValue` 定义在 React 组件文件里，core 反过来 import 组件，
                   方向是反的。类型搬进 core 之后依赖方向才对——组件依赖 core，不是反过来。

                   `timezoneOptions()` 是**候选来源**，`withCurrentTimezone()` 才是渲染
                   用的列表。分成两步是因为来源和取值本来就不是同一个 API，而它们不一致：
                   Chromium 的 `Intl.supportedValuesOf("timeZone")` 有 418 个区，**不含
                   "UTC"**（实测 hasUTC=false），而 `resolvedOptions().timeZone` 在
                   TZ=UTC 的机器上恰好返回 "UTC"。选中值不在选项里，Radix/Reka 的触发器
                   就渲染成空白——已存任务带着 Gateway 接受过的任意时区时同理。
                   所以把当前值并进候选，而不是把它丢掉。

                   这一处原本是 React 的缺陷，同一个修法已经同步到
                   frontend/src/components/workspace/scheduled-task-schedule-input.tsx，
                   两边渲染同一份列表，对照台账因此不增行。
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

/**
 * 渲染用的时区列表：候选加上当前值。
 *
 * 选中值不在选项里时触发器会显示为空，见文件头。
 */
export function withCurrentTimezone(
  options: readonly string[],
  current: string,
): string[] {
  return current && !options.includes(current)
    ? [current, ...options]
    : [...options];
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
