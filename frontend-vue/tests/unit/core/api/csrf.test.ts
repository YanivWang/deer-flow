import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendCsrfHeader,
  isCsrfProtectedMethod,
  readBrowserCookie,
  readCookieValue,
} from "../../../../app/core/api/csrf";

describe("CSRF API contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mirrors the Gateway state-changing method set exactly", () => {
    expect(isCsrfProtectedMethod("POST")).toBe(true);
    expect(isCsrfProtectedMethod("put")).toBe(true);
    expect(isCsrfProtectedMethod("DELETE")).toBe(true);
    expect(isCsrfProtectedMethod("PATCH")).toBe(true);
    expect(isCsrfProtectedMethod("GET")).toBe(false);
    expect(isCsrfProtectedMethod("HEAD")).toBe(false);
    expect(isCsrfProtectedMethod("OPTIONS")).toBe(false);
    expect(isCsrfProtectedMethod("TRACE")).toBe(false);
    expect(isCsrfProtectedMethod("CONNECT")).toBe(false);
  });

  it("reads and decodes the csrf_token cookie", () => {
    expect(readCookieValue("theme=dark; csrf_token=token%201; other=x", "csrf_token")).toBe(
      "token 1",
    );
    expect(readCookieValue("theme=dark", "csrf_token")).toBeUndefined();
  });

  it("adds CSRF only for protected methods and preserves explicit headers", () => {
    const postHeaders = appendCsrfHeader(new Headers(), "POST", "csrf_token=token-1");
    expect(postHeaders.get("X-CSRF-Token")).toBe("token-1");

    const getHeaders = appendCsrfHeader(new Headers(), "GET", "csrf_token=token-1");
    expect(getHeaders.has("X-CSRF-Token")).toBe(false);

    const explicitHeaders = appendCsrfHeader(
      new Headers({ "X-CSRF-Token": "caller-token" }),
      "POST",
      "csrf_token=token-1",
    );
    expect(explicitHeaders.get("X-CSRF-Token")).toBe("caller-token");
  });

  it("is safe to call without a browser document", () => {
    vi.stubGlobal("document", undefined);
    expect(readBrowserCookie("csrf_token")).toBeUndefined();
  });
});
