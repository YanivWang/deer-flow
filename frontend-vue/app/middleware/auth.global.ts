/*
  【文件职责】     将 auth 纯决策接到 Nuxt 路由边界。
  【对应 frontend/】 frontend/src/app/workspace/layout.tsx
  【架构位置】     L3
  【主要导出】     全局路由 middleware
  【依赖关系】     消费 runtimeConfig 与 decideAuthNavigation
  【边界与注意】   401 才是未登录；Gateway 不可用不得伪装成 unauthenticated。
*/

import {
  buildLoginLocation,
  decideAuthNavigation,
  isEnabledRuntimeFlag,
} from "@/core/auth/decision";
import { probeSession } from "@/core/auth/session";

export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig();
  const authDisabled = isEnabledRuntimeFlag(config.public.authDisabled);
  let authenticated = false;
  if (to.path.startsWith("/workspace") && !authDisabled) {
    const session = await probeSession();
    if (session.tag === "unavailable") {
      return navigateTo("/login?error=gateway_unavailable");
    }
    if (session.tag === "authenticated" && session.user.needs_setup) {
      return navigateTo("/setup");
    }
    authenticated = session.tag === "authenticated";
  }
  const decision = decideAuthNavigation({
    path: to.path,
    authDisabled,
    authenticated,
  });
  if (decision === "login") {
    // 回跳目标的安全校验在纯函数里（06 §鉴权中间件切成纯函数）：
    // 这一行只负责执行副作用。
    return navigateTo(buildLoginLocation(to.fullPath));
  }
});
