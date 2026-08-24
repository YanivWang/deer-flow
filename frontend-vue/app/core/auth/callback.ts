/*
  【文件职责】     将 OIDC callback 的 session 结果收敛为可渲染状态和安全跳转。
  【架构位置】     L3 authentication
  【主要导出】     resolveAuthCallback · AuthCallbackResolution
  【依赖关系】     ./next-path · ./session
  【边界与注意】   只消费 session cookie 结果；不接触密码、token 或浏览器存储。
*/

import { resolveAuthNextPath } from "./next-path";
import type { SessionProbe } from "./session";

export type AuthCallbackResolution = {
  status: "success" | "unauthenticated" | "unavailable";
  location: string;
};

export function resolveAuthCallback(
  session: SessionProbe,
  nextPath: string | null | undefined,
): AuthCallbackResolution {
  const safeNext = resolveAuthNextPath(nextPath);
  if (session.tag === "authenticated") {
    return { status: "success", location: safeNext };
  }
  if (session.tag === "unauthenticated") {
    return {
      status: "unauthenticated",
      location: "/login?error=sso_failed",
    };
  }
  return {
    status: "unavailable",
    location: `/login?error=gateway_unavailable&next=${encodeURIComponent(safeNext)}`,
  };
}
