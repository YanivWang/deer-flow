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

/**
 * Hosts safe to interpolate into a quoted RFC 7239 `Forwarded` value.
 * Anything outside this set could close the quote and inject a second
 * `host=` parameter, which is the value the Gateway trusts first.
 */
const SAFE_FORWARDED_HOST = /^[A-Za-z0-9._[\]:-]+$/;

export function isSafeForwardedHost(host: string): boolean {
  return SAFE_FORWARDED_HOST.test(host);
}

/**
 * Describe the entry the browser actually targeted, for the Gateway's
 * client-facing origin reconstruction (`_request_origin` in
 * backend/app/gateway/csrf_middleware.py), which in turn derives the OIDC
 * `redirect_uri`.
 *
 * `Forwarded` outranks `X-Forwarded-Host` in that lookup, so all four headers
 * are emitted together and every one is overwritten rather than passed
 * through — otherwise a browser-supplied `Forwarded: host=evil.example` would
 * steer the IdP redirect back to an attacker's origin.
 */
export function buildForwardingHeaders(
  host: string,
  proto: "http" | "https",
): Record<string, string> {
  if (!isSafeForwardedHost(host)) {
    throw new Error(`unsafe forwarded host: ${host}`);
  }
  // IPv6 literals carry colons inside brackets; only a colon after the closing
  // bracket is a port.
  const afterBracket = host.slice(host.lastIndexOf("]") + 1);
  const port = afterBracket.includes(":")
    ? (afterBracket.split(":").pop() as string)
    : proto === "https"
      ? "443"
      : "80";

  return {
    forwarded: `host="${host}";proto=${proto}`,
    "x-forwarded-host": host,
    "x-forwarded-proto": proto,
    "x-forwarded-port": port,
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
