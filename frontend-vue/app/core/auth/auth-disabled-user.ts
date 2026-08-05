/*
  【文件职责】     见下方源码；本文件由 frontend/src/core/auth/auth-disabled-user.ts retype 而来。
  【对应 frontend/】 frontend/src/core/auth/auth-disabled-user.ts
  【架构位置】     L3
  【主要导出】     AUTH_DISABLED_USER / isAuthDisabledMode
  【依赖关系】     见下方 import；改写清单由 scripts/land-retyped.mjs 声明
  【边界与注意】   RETYPED：内容**不是**上游逐字节等同，因此不参与 COPIED hash 护城河。
                   相对上游的改动只有这些：读 process.env；Nuxt 客户端产物没有该全局，改为接收注入的 runtime options。
                   勿手改——`make land-retyped-check` 会红；确需手改就登记进
                   land-retyped.mjs 的 HAND_MAINTAINED 并写明理由。
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
