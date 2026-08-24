/*
  【文件职责】     见下方导出与 JSDoc。
  【架构位置】     L3
  【主要导出】     AUTH_DISABLED_USER / isAuthDisabledMode
  【依赖关系】     见下方 import。
  【边界与注意】   本文件由本仓维护；行为由 tests/ 下的用例约束。
*/

import { getDeerFlowRuntimeOptions } from "../config";

import type { User } from "./types";

export const AUTH_DISABLED_USER: User = {
  id: "default",
  email: "default@test.local",
  system_role: "admin",
  needs_setup: false,
  oauth_provider: null,
};

export function isAuthDisabledMode() {
  return getDeerFlowRuntimeOptions().authDisabled;
}
