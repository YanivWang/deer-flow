/*
  【文件职责】     穷举 Markdown href 协议 allowlist。
  【对应 frontend/】 frontend/src/components/workspace/messages/markdown-link.tsx
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     app/core/markdown/links
  【边界与注意】   MessageList 的真实 components 注入由 chat/message-list-links 覆盖。
*/

import { describe, expect, it } from "vitest";

import { isSafeMarkdownHref } from "@/core/markdown/links";

describe("isSafeMarkdownHref", () => {
  it.each([
    "https://example.com/report",
    "http://example.com/report",
    "mailto:owner@example.com",
    "tel:+12025550123",
    "/workspace/chats/new",
    "report.md",
    "./report.md",
    "../assets/chart.png",
    "#answer",
  ])("allows %s", (href) => expect(isSafeMarkdownHref(href)).toBe(true));

  it.each([
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "//evil.example/path",
    "\\\\evil.example\\path",
    "",
  ])("blocks %s", (href) => expect(isSafeMarkdownHref(href)).toBe(false));
});
