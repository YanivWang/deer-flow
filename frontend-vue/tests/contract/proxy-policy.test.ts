import { describe, expect, it } from "vitest";

import {
  filterRequestHeaders,
  filterResponseHeaders,
  isAllowedLangGraphPath,
  rewriteLangGraphPath,
} from "../../server/utils/proxy-policy";

describe("proxy policy", () => {
  it("allows only the LangGraph-compatible upstream prefixes", () => {
    expect(isAllowedLangGraphPath("/threads/t/runs")).toBe(true);
    expect(isAllowedLangGraphPath("/memory")).toBe(true);
    expect(isAllowedLangGraphPath("/admin")).toBe(false);
  });

  it("rewrites the public /api/langgraph prefix to the Gateway native /api prefix", () => {
    expect(rewriteLangGraphPath("/api/langgraph/threads/t/runs/stream")).toBe(
      "/api/threads/t/runs/stream",
    );
    expect(rewriteLangGraphPath("/api/langgraph/runs/stream")).toBe("/api/runs/stream");
    expect(rewriteLangGraphPath("/api/langgraph/admin/secrets")).toBeUndefined();
  });

  it("strips client-controlled credential headers before proxying", () => {
    const headers = filterRequestHeaders(
      new Headers({
        authorization: "Bearer injected",
        "proxy-authenticate": "Basic realm=bad",
        "x-api-key": "bad",
        cookie: "access_token=session",
      }),
    );

    expect(headers.has("authorization")).toBe(false);
    expect(headers.has("proxy-authenticate")).toBe(false);
    expect(headers.has("x-api-key")).toBe(false);
    expect(headers.get("cookie")).toBe("access_token=session");
  });

  it("strips upstream set-cookie while preserving SSE contract headers", () => {
    const headers = filterResponseHeaders(
      new Headers({
        "cache-control": "no-cache",
        "content-location": "/api/threads/thread-1/runs/run-1",
        "set-cookie": "access_token=evil",
        "content-type": "text/event-stream",
        "x-accel-buffering": "no",
      }),
    );

    expect(headers.has("set-cookie")).toBe(false);
    expect(headers.get("cache-control")).toBe("no-cache");
    expect(headers.get("content-location")).toBe("/api/threads/thread-1/runs/run-1");
    expect(headers.get("content-type")).toBe("text/event-stream");
    expect(headers.get("x-accel-buffering")).toBe("no");
  });
});
