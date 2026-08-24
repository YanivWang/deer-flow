/*
  【文件职责】     承载定时任务的 schedule 取值类型，供 recipes.ts 与将来的 Vue 组件共用。
  【架构位置】     L3 类型
  【主要导出】     ScheduleValue
  【依赖关系】     零依赖；被 app/core/scheduled-tasks/recipes.ts 引用
  【边界与注意】   06 §M1 1b 里 `retype-component-type` 那一条就是这个文件的由来：
                   上游把 `ScheduleValue` 定义在 React 组件文件里，core 反过来 import 组件，
                   方向是反的。类型搬进 core 之后依赖方向才对——组件依赖 core，不是反过来。
                   **只搬类型**，组件本体（CronPreset 解析、UI 状态）留在 M4b 重写。
*/

export type ScheduleValue = {
  schedule_type: "once" | "cron";
  schedule_spec: { cron?: string; run_at?: string };
  timezone: string;
};
