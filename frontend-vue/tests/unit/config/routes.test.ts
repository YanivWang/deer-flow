/*
  【文件职责】     穷举代理环境组合并锁定前缀、流式选项与安全规则。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     消费 config/routes.ts
  【边界与注意】   修改代理拓扑必须同步本文件。
*/

import { describe, expect, it } from "vitest";
import {
  buildForwardingHeaders,
  buildProxyRules,
  hasUnsafeProxyPath,
  isSafeForwardedHost,
} from "../../../config/routes";

const gateway = "http://127.0.0.1:8011";

describe("buildProxyRules", () => {
  it.each([
    [{}, ["/api/langgraph/**", "/api/**"]],
    [
      { NUXT_PUBLIC_LANGGRAPH_BASE_URL: "https://langgraph.example" },
      ["/api/**"],
    ],
    [
      { NUXT_PUBLIC_BACKEND_BASE_URL: "https://api.example" },
      ["/api/langgraph/**"],
    ],
    [
      {
        NUXT_PUBLIC_LANGGRAPH_BASE_URL: "https://langgraph.example",
        NUXT_PUBLIC_BACKEND_BASE_URL: "https://api.example",
      },
      [],
    ],
  ])("handles environment combination %#", (flags, expectedKeys) => {
    const rules = buildProxyRules({
      DEER_FLOW_INTERNAL_GATEWAY_BASE_URL: gateway,
      ...flags,
    });
    expect(Object.keys(rules)).toEqual(expectedKeys);
  });

  it("rewrites the specific langgraph prefix before the generic API rule", () => {
    const rules = buildProxyRules({
      DEER_FLOW_INTERNAL_GATEWAY_BASE_URL: gateway,
    });
    expect(rules).toEqual({
      "/api/langgraph/**": {
        proxy: {
          to: `${gateway}/api/**`,
          sendStream: true,
          streamRequest: true,
        },
      },
      "/api/**": {
        proxy: {
          to: `${gateway}/api/**`,
          sendStream: true,
          streamRequest: true,
        },
      },
    });
  });
});

describe("hasUnsafeProxyPath", () => {
  it.each([
    "/api/langgraph/%2e%2e/features",
    "/api/langgraph/%252e%252e/features",
    "/api/langgraph/..%2ffeatures",
    "/api/langgraph/%2e%2e%5cfeatures",
    "/api/langgraph/./features",
  ])("rejects encoded traversal %s", (path) =>
    expect(hasUnsafeProxyPath(path)).toBe(true),
  );

  it("allows a normal encoded identifier", () => {
    expect(hasUnsafeProxyPath("/api/langgraph/threads/a%20b/state")).toBe(
      false,
    );
  });
});

describe("isSafeForwardedHost", () => {
  it.each([
    "localhost:3101",
    "deerflow.example.com",
    "127.0.0.1:8001",
    "[::1]:3101",
  ])("accepts %s", (host) => expect(isSafeForwardedHost(host)).toBe(true));

  // A quote would close the quoted Forwarded value and let a second host=
  // parameter through, which is the value the Gateway trusts first.
  it.each([
    'a";proto=https;host="evil.example',
    "host with space",
    "evil.example\r\nx-injected: 1",
    "",
  ])("rejects %j", (host) => expect(isSafeForwardedHost(host)).toBe(false));
});

describe("buildForwardingHeaders", () => {
  it("keeps the explicit port and quotes the host", () => {
    expect(buildForwardingHeaders("localhost:3101", "http")).toEqual({
      forwarded: 'host="localhost:3101";proto=http',
      "x-forwarded-host": "localhost:3101",
      "x-forwarded-proto": "http",
      "x-forwarded-port": "3101",
    });
  });

  it.each([
    ["deerflow.example.com", "https", "443"],
    ["deerflow.example.com", "http", "80"],
  ])("defaults %s over %s to port %s", (host, proto, port) =>
    expect(
      buildForwardingHeaders(host, proto as "http" | "https")[
        "x-forwarded-port"
      ],
    ).toBe(port),
  );

  it("treats only a colon after the IPv6 bracket as a port", () => {
    expect(
      buildForwardingHeaders("[::1]:3101", "http")["x-forwarded-port"],
    ).toBe("3101");
    expect(buildForwardingHeaders("[::1]", "https")["x-forwarded-port"]).toBe(
      "443",
    );
  });

  it("refuses to interpolate an injectable host", () => {
    expect(() =>
      buildForwardingHeaders('a";proto=https;host="evil.example', "http"),
    ).toThrow(/unsafe forwarded host/);
  });
});
