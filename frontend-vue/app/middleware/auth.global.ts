/*
  【文件职责】     将 auth 纯决策接到 Nuxt 路由边界。
  【对应 frontend/】 frontend/src/app/workspace/layout.tsx
  【架构位置】     L3
  【主要导出】     全局路由 middleware
  【依赖关系】     消费 runtimeConfig 与 decideAuthNavigation
  【边界与注意】   NUXT_PUBLIC_AUTH_DISABLED=1 仅用于 M0/mock 合同。
*/

import {
  decideAuthNavigation,
  isEnabledRuntimeFlag,
} from "@/core/auth/decision";

export default defineNuxtRouteMiddleware((to) => {
  const config = useRuntimeConfig();
  const decision = decideAuthNavigation({
    path: to.path,
    authDisabled: isEnabledRuntimeFlag(config.public.authDisabled),
    authenticated: false,
  });
  if (decision === "login") {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }
});
