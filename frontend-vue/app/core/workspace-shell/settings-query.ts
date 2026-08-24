/*
  【文件职责】     校验 settings 深链并构造只移除 settings 的关闭路由。
  【架构位置】     L3 workspace shell
  【主要导出】     SETTINGS_SECTIONS · readSettingsSection · buildSettingsCloseLocation
  【依赖关系】     SettingsSection · vue-router types
  【边界与注意】   保留其他 query/hash；组件用 push 形成可回放 history。
*/
import type { SettingsSection } from "@/composables/useSettingsDialog";
import type { LocationQueryRaw, RouteLocationRaw } from "vue-router";

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  "account",
  "appearance",
  "notification",
  "tools",
  "skills",
  "memory",
  "integrations",
  "channels",
  "about",
];

export function readSettingsSection(value: unknown): SettingsSection | null {
  const requested = Array.isArray(value) ? value[0] : value;
  return typeof requested === "string" &&
    SETTINGS_SECTIONS.includes(requested as SettingsSection)
    ? (requested as SettingsSection)
    : null;
}

type RouteLocation = {
  path: string;
  query: LocationQueryRaw;
  hash?: string;
};

export function buildSettingsCloseLocation(
  route: RouteLocation,
): RouteLocationRaw {
  const { settings: _settings, ...query } = route.query;
  return { path: route.path, query, hash: route.hash ?? "" };
}
