/*
  【文件职责】     以纯函数决定路由是否需要登录跳转。
  【对应 frontend/】 frontend/src/core/auth/auth-disabled-user.ts
  【架构位置】     L3
  【主要导出】     decideAuthNavigation
  【依赖关系】     被全局 middleware 与 node 单测调用
  【边界与注意】   M0 只验证 auth-disabled；真实 session 接线属于后续里程碑。
*/

export type AuthNavigation = "allow" | "login";

export function isEnabledRuntimeFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function decideAuthNavigation(input: {
  path: string;
  authDisabled: boolean;
  authenticated: boolean;
}): AuthNavigation {
  if (!input.path.startsWith("/workspace")) {
    return "allow";
  }
  return input.authDisabled || input.authenticated ? "allow" : "login";
}
