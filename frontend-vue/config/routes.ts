/*
  【文件职责】     定义渲染分区与 Gateway 代理规则的单一来源。
  【对应 frontend/】 frontend/next.config.js
  【架构位置】     L3
  【主要导出】     buildProxyRules、csrRoutes、prerenderRoutes
  【依赖关系】     渲染分区供 nuxt.config.ts 使用；代理契约供 handler 与单测校验
  【边界与注意】   生产代理由 server/routes/api catch-all 执行，不能改回会绕过 guard 的 routeRules.proxy。
*/

export const csrRoutes = [
  "/workspace/**",
  "/login",
  "/setup",
  "/auth/**",
] as const;

export const prerenderRoutes = ["/", "/pricing", "/about"] as const;

export const MAX_PROXY_BODY_BYTES = 20 * 1024 * 1024;

const streamOptions = { sendStream: true, streamRequest: true } as const;

export type ProxyEnvironment = Readonly<Record<string, string | undefined>>;

export function buildProxyRules(env: ProxyEnvironment = process.env) {
  const gateway =
    env.DEER_FLOW_INTERNAL_GATEWAY_BASE_URL ?? "http://127.0.0.1:8001";

  return {
    ...(env.NUXT_PUBLIC_LANGGRAPH_BASE_URL
      ? {}
      : {
          "/api/langgraph/**": {
            proxy: { to: `${gateway}/api/**`, ...streamOptions },
          },
        }),
    ...(env.NUXT_PUBLIC_BACKEND_BASE_URL
      ? {}
      : {
          "/api/**": {
            proxy: { to: `${gateway}/api/**`, ...streamOptions },
          },
        }),
  };
}

export function hasUnsafeProxyPath(rawUrl: string): boolean {
  let candidate = rawUrl.split("?", 1)[0] ?? "";
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const normalized = candidate.replaceAll("\\", "/").toLowerCase();
    if (
      normalized
        .split("/")
        .some((segment) => segment === ".." || segment === ".")
    ) {
      return true;
    }
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) {
        break;
      }
      candidate = decoded;
    } catch {
      return true;
    }
  }
  return candidate.includes("\\");
}
