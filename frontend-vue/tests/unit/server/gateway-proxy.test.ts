/*
  【文件职责】     穷举 Nitro proxy 请求体声明判定与大小边界。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     server/utils/gateway-proxy · config/routes
  【边界与注意】   真实传输、SSE 与 traversal 另由 tests/m0/proxy.spec.ts 覆盖。
*/

import { describe, expect, it } from "vitest";

import { MAX_PROXY_BODY_BYTES } from "../../../config/routes";
import { inspectProxyRequestBody } from "../../../server/utils/gateway-proxy";

describe("inspectProxyRequestBody", () => {
  it.each(["DELETE", "POST", "PATCH", "PUT"])(
    "treats bodyless %s as bodyless instead of requiring Content-Length",
    (method) => {
      expect(inspectProxyRequestBody(method, undefined, undefined)).toEqual({
        kind: "none",
      });
      expect(inspectProxyRequestBody(method, "0", undefined)).toEqual({
        kind: "none",
      });
    },
  );

  it("recognizes and limits a declared fixed-length body", () => {
    expect(inspectProxyRequestBody("DELETE", "17", undefined)).toEqual({
      kind: "fixed",
      bytes: 17,
    });
    expect(() =>
      inspectProxyRequestBody(
        "DELETE",
        String(MAX_PROXY_BODY_BYTES + 1),
        undefined,
      ),
    ).toThrowError(expect.objectContaining({ statusCode: 413 }));
  });

  it("recognizes chunked bodies without demanding Content-Length", () => {
    expect(inspectProxyRequestBody("DELETE", undefined, "chunked")).toEqual({
      kind: "chunked",
    });
  });

  it.each(["-1", "1.5", "1e3", "NaN", ""])(
    "rejects invalid Content-Length %j",
    (value) => {
      expect(() =>
        inspectProxyRequestBody("POST", value, undefined),
      ).toThrowError(expect.objectContaining({ statusCode: 400 }));
    },
  );

  it("never reads bodies for methods without payload semantics", () => {
    expect(inspectProxyRequestBody("GET", "99", "chunked")).toEqual({
      kind: "none",
    });
  });
});
