/*
  【文件职责】     将 auth 纯决策接到 Nuxt 路由边界。
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
import { authSessionQueryOptions } from "@/core/auth/session-query";
import { useQueryClient } from "@tanstack/vue-query";

export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig();
  const authDisabled = isEnabledRuntimeFlag(config.public.authDisabled);
  let authenticated = false;
  if (to.path.startsWith("/workspace") && !authDisabled) {
    const session = await useQueryClient().fetchQuery(
      authSessionQueryOptions(),
    );
    if (session.tag === "unavailable") {
      // Preserve the protected route. The workspace consumes the same query
      // state and exposes a visible retry path until the Gateway recovers.
      return;
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
