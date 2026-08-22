/*
  【文件职责】     固定 WP-06 HTML preview 的完整性、Range 截断和 write-file 边界。
  【对应 frontend/】 frontend/src/core/artifacts/preview.ts
  【架构位置】     测试
  【主要导出】     canRenderArtifactHtml 回归
  【依赖关系】     app/core/artifacts/preview-policy.ts
  【边界与注意】   正式截断内容永远不得创建 iframe/srcdoc；流式 prefix 与完成文档分开判断。
*/

import { describe, expect, it } from "vitest";

import {
  canRenderArtifactHtml,
  isCompleteHtmlDocument,
} from "@/core/artifacts/preview-policy";

const COMPLETE =
  "<!doctype html><html><head><style>body{color:red}</style></head><body><h1>OK</h1></body></html>";

describe("artifact HTML preview policy", () => {
  it("requires a complete ordered document for a completed formal artifact", () => {
    expect(isCompleteHtmlDocument(COMPLETE)).toBe(true);
    for (const content of [
      "<html><body><h1>missing close",
      "<html><body>wrong order</html></body>",
      "<html><head><style>x</head><body>broken</body></html>",
      "<body>fragment</body>",
    ]) {
      expect(isCompleteHtmlDocument(content)).toBe(false);
    }
  });

  it("rejects every truncated formal HTML preview even when the prefix looks complete", () => {
    expect(
      canRenderArtifactHtml({
        source: "formal",
        content: COMPLETE,
        truncated: true,
        fullContentLoaded: false,
      }),
    ).toBe(false);
  });

  it("allows an assembling write-file prefix but requires D3 completeness after OK", () => {
    expect(
      canRenderArtifactHtml({
        source: "write-file-draft",
        content: "<!doctype html><html><head><style>.hero{color:red}",
        truncated: false,
        fullContentLoaded: false,
      }),
    ).toBe(true);
    expect(
      canRenderArtifactHtml({
        source: "write-file-draft",
        content: "<!doctype html><html><body>unfinished",
        truncated: false,
        fullContentLoaded: true,
        toolResult: "OK",
      }),
    ).toBe(false);
    expect(
      canRenderArtifactHtml({
        source: "write-file-draft",
        content: COMPLETE,
        truncated: false,
        fullContentLoaded: true,
        toolResult: "OK",
      }),
    ).toBe(true);
  });
});
