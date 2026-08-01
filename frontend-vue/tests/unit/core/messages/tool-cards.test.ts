import { describe, expect, it } from "vitest";

import { extractToolRichCards } from "../../../../app/core/messages/tool-cards";

describe("tool rich cards", () => {
  it("describes assistant tool calls with browser and draft artifact details", () => {
    expect(
      extractToolRichCards({
        type: "ai",
        tool_calls: [
          {
            id: "call-browser",
            name: "browser_navigate",
            args: { url: "https://example.com" },
          },
          {
            id: "call-write",
            name: "write_file",
            args: {
              path: "/mnt/user-data/outputs/app.ts",
              content: "console.log('hi')",
            },
          },
        ],
      }),
    ).toEqual([
      {
        description: null,
        details: ["调用：call-browser", "URL：https://example.com"],
        draftPreview: null,
        id: "call-browser",
        kind: "assistant-call",
        name: "browser_navigate",
        title: "在浏览器中打开 https://example.com",
      },
      {
        description: "/mnt/user-data/outputs/app.ts 的草稿预览",
        details: ["调用：call-write", "路径：/mnt/user-data/outputs/app.ts"],
        draftPreview: {
          content: "console.log('hi')",
          filename: "app.ts",
          language: "typescript",
          targetPath: "/mnt/user-data/outputs/app.ts",
        },
        id: "call-write",
        kind: "assistant-call",
        name: "write_file",
        title: "写入 app.ts",
      },
    ]);
  });

  it("describes tool results by tool call id without requiring assistant calls", () => {
    expect(
      extractToolRichCards({
        type: "tool",
        name: "browser_snapshot",
        tool_call_id: "call-browser",
        content: "Page title: DeerFlow",
      }),
    ).toEqual([
      {
        description: "Page title: DeerFlow",
        details: ["调用：call-browser", "结果：Page title: DeerFlow"],
        draftPreview: null,
        id: "call-browser",
        kind: "tool-result",
        name: "browser_snapshot",
        title: "Browser Snapshot 结果",
      },
    ]);
  });

  it("describes skill install and staged artifact write actions without claiming runtime success", () => {
    expect(
      extractToolRichCards({
        type: "ai",
        tool_calls: [
          {
            id: "call-skill",
            name: "install_skill",
            args: { path: "/mnt/user-data/outputs/weather-skill.zip" },
          },
          {
            id: "call-append",
            name: "append_artifact_chunk",
            args: {
              target_path: "/mnt/user-data/outputs/report.html",
              chunk: "<main>ready</main>",
            },
          },
          {
            id: "call-finalize",
            name: "finalize_artifact_write",
            args: { target_path: "/mnt/user-data/outputs/report.html" },
          },
        ],
      }),
    ).toEqual([
      {
        description: "从 /mnt/user-data/outputs/weather-skill.zip 安装技能包",
        details: ["调用：call-skill", "路径：/mnt/user-data/outputs/weather-skill.zip"],
        draftPreview: null,
        id: "call-skill",
        kind: "assistant-call",
        name: "install_skill",
        title: "安装技能 weather-skill.zip",
      },
      {
        description: "/mnt/user-data/outputs/report.html 的草稿预览",
        details: [
          "调用：call-append",
          "目标：/mnt/user-data/outputs/report.html",
          "片段：<main>ready</main>",
        ],
        draftPreview: {
          content: "<main>ready</main>",
          filename: "report.html",
          language: "html",
          targetPath: "/mnt/user-data/outputs/report.html",
        },
        id: "call-append",
        kind: "assistant-call",
        name: "append_artifact_chunk",
        title: "追加分段产物内容 report.html",
      },
      {
        description: "后端验证后正在完成分段产物。",
        details: ["调用：call-finalize", "目标：/mnt/user-data/outputs/report.html"],
        draftPreview: null,
        id: "call-finalize",
        kind: "assistant-call",
        name: "finalize_artifact_write",
        title: "完成分段产物 report.html",
      },
    ]);
  });
});
