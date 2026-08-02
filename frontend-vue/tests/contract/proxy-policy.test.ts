import { describe, expect, it } from "vitest";

import {
  buildForwardHeaders,
  isAllowedLangGraphPath,
  LANGGRAPH_COMPAT_POLICY,
  shouldRequireCsrf,
  stripResponseHeaders,
} from "../../app/core/auth/proxy-policy";

describe("LangGraph proxy policy", () => {
  it("allows only the documented upstream namespaces", () => {
    expect(isAllowedLangGraphPath("threads/search")).toBe(true);
    expect(isAllowedLangGraphPath("runs/stream")).toBe(true);
    expect(isAllowedLangGraphPath("admin/secrets")).toBe(false);
  });

  it("strips browser hop-by-hop and client credential headers", () => {
    const headers = buildForwardHeaders(
      {
        Authorization: "Bearer forged",
        Origin: "https://evil.example",
        Referer: "https://evil.example",
        "X-API-Key": "forged",
        "X-CSRF-Token": "csrf",
      },
      "access-token",
    );
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("origin")).toBeNull();
    expect(headers.get("referer")).toBeNull();
    expect(headers.get("x-api-key")).toBeNull();
    expect(headers.get("x-csrf-token")).toBe("csrf");
    expect(headers.get("cookie")).toBe("access_token=access-token");
  });

  it("requires CSRF only for state-changing methods", () => {
    expect(shouldRequireCsrf("GET")).toBe(false);
    expect(shouldRequireCsrf("HEAD")).toBe(false);
    expect(shouldRequireCsrf("POST")).toBe(true);
    expect(shouldRequireCsrf("PATCH")).toBe(true);
  });

  it("removes response transport and cookie headers", () => {
    const headers = stripResponseHeaders(
      new Headers({
        "Content-Type": "text/event-stream",
        "Content-Length": "10",
        "Set-Cookie": "access_token=upstream",
      }),
    );
    expect(headers.get("content-type")).toBe("text/event-stream");
    expect(headers.get("content-length")).toBeNull();
    expect(headers.get("set-cookie")).toBeNull();
    expect(LANGGRAPH_COMPAT_POLICY.timeoutMs).toBe(120_000);
  });
});
