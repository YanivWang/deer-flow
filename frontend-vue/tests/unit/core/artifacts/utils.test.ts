import { describe, expect, it } from "vitest";

import {
  artifactApiUrl,
  artifactCodeInfo,
  artifactCodeLanguage,
  artifactExtensionLabel,
  artifactFilename,
  describeWriteFileDraftPreview,
  describeArtifactViewer,
  getBrowserPreviewKind,
  resolveMarkdownArtifactUrl,
  resolveMessageMediaUrl,
} from "../../../../app/core/artifacts/utils";
import {
  appendHtmlPreviewScrollRestoration,
  collectHtmlPreviewResourceUrls,
  createHtmlPreviewScrollKey,
  resolveHtmlPreviewResourceReference,
  rewriteHtmlPreviewResourceUrls,
} from "../../../../app/core/artifacts/preview";

describe("artifact utils", () => {
  it("builds encoded artifact URLs against the Nuxt API proxy", () => {
    expect(artifactApiUrl({
      filepath: "/mnt/user-data/outputs/report 1.md",
      threadId: "thread/a",
    })).toBe("/api/threads/thread%2Fa/artifacts/mnt/user-data/outputs/report%201.md");
    expect(artifactApiUrl({
      download: true,
      filepath: "/mnt/user-data/outputs/report%201.md",
      isMock: true,
      threadId: "thread-a",
    })).toBe("/mock/api/threads/thread-a/artifacts/mnt/user-data/outputs/report%201.md?download=true");
  });

  it("classifies browser-previewable files", () => {
    expect(getBrowserPreviewKind("/tmp/chart.PNG")).toBe("image");
    expect(getBrowserPreviewKind("/tmp/audio.m4a")).toBe("audio");
    expect(getBrowserPreviewKind("/tmp/movie.webm")).toBe("video");
    expect(getBrowserPreviewKind("/tmp/report.pdf")).toBe("iframe");
    expect(getBrowserPreviewKind("/tmp/index.html")).toBe("html");
    expect(getBrowserPreviewKind("/tmp/notes.md")).toBe("markdown");
    expect(getBrowserPreviewKind("/tmp/source.ts")).toBe("code");
    expect(getBrowserPreviewKind("/tmp/data.xlsx")).toBeNull();
  });

  it("resolves markdown artifact and message media URLs", () => {
    expect(resolveMarkdownArtifactUrl("/mnt/report.md#section", "thread-a")).toBe(
      "/api/threads/thread-a/artifacts/mnt/report.md#section",
    );
    expect(resolveMessageMediaUrl({
      artifactPaths: ["/mnt/user-data/outputs/chart.png"],
      src: "chart.png?raw=1",
      threadId: "thread-a",
    })).toBe("/api/threads/thread-a/artifacts/mnt/user-data/outputs/chart.png?raw=1");
    expect(resolveMessageMediaUrl({
      artifactPaths: [],
      src: "../secret.png",
      threadId: "thread-a",
    })).toBe("../secret.png");
  });

  it("describes viewer state for preview and fallback files", () => {
    expect(describeArtifactViewer({
      filepath: "/tmp/chart.png",
      threadId: "thread-a",
    })).toEqual({
      artifactUrl: "/api/threads/thread-a/artifacts/tmp/chart.png",
      canPreview: true,
      downloadFilename: "chart.png",
      downloadUrl: "/api/threads/thread-a/artifacts/tmp/chart.png?download=true",
      extensionLabel: "PNG",
      fallbackDescription: "如果浏览器预览不可用，请打开或下载此产物。",
      filename: "chart.png",
      previewDescription: "图片预览通过已认证的产物路由加载。",
      previewKind: "image",
    });
    expect(describeArtifactViewer({
      filepath: "/tmp/site/index.html",
      threadId: "thread-a",
    })).toMatchObject({
      artifactUrl: "/api/threads/thread-a/artifacts/tmp/site/index.html",
      canPreview: true,
      previewDescription: "HTML 预览会在相对资源改写到产物 API 路径后，以沙箱 blob 加载。",
      previewKind: "html",
    });
    expect(describeArtifactViewer({
      filepath: "/tmp/notes.md",
      threadId: "thread-a",
    })).toMatchObject({
      canPreview: true,
      previewDescription: "Markdown 预览复用聊天消息的安全富文本渲染器。",
      previewKind: "markdown",
    });
    expect(describeArtifactViewer({
      filepath: "/tmp/report.pdf",
      threadId: "thread-a",
    })).toMatchObject({
      fallbackDescription: "如果浏览器预览不可用，请打开或下载此产物。",
      previewDescription: "PDF 预览已沙箱隔离；仍可下载后用外部阅读器打开。",
      previewKind: "iframe",
    });
    expect(describeArtifactViewer({
      filepath: "/tmp/data.xlsx",
      threadId: "thread-a",
    })).toMatchObject({
      canPreview: false,
      fallbackDescription: "Excel 文件无法在此处预览。请下载或用兼容应用打开。",
      previewKind: null,
    });
    expect(artifactFilename("/tmp/deck.pptx?version=1")).toBe("deck.pptx");
    expect(artifactExtensionLabel("/tmp/deck.pptx?version=1")).toBe("PowerPoint");
    expect(artifactCodeLanguage("/tmp/source.vue?version=1")).toBe("vue");
    expect(artifactCodeLanguage("/tmp/README")).toBe("text");
  });

  it("maps source files to React-backed editor languages", () => {
    expect(artifactCodeInfo("/tmp/app.tsx")).toEqual({
      isCodeFile: true,
      language: "tsx",
    });
    expect(artifactCodeInfo("/tmp/SKILL.skill")).toEqual({
      isCodeFile: true,
      language: "markdown",
    });
    expect(artifactCodeInfo("/tmp/config.jsonc")).toEqual({
      isCodeFile: true,
      language: "jsonc",
    });
    expect(artifactCodeInfo("/tmp/server.log")).toEqual({
      isCodeFile: true,
      language: "text",
    });
    expect(artifactCodeInfo("/tmp/archive.zip")).toEqual({
      isCodeFile: false,
      language: null,
    });
  });

  it("describes write-file draft previews from tool payloads", () => {
    expect(describeWriteFileDraftPreview({
      chunk: "console.log('hi')",
      target_path: "/mnt/user-data/outputs/app.ts",
    })).toEqual({
      content: "console.log('hi')",
      filename: "app.ts",
      language: "typescript",
      targetPath: "/mnt/user-data/outputs/app.ts",
    });
    expect(describeWriteFileDraftPreview({ path: "/tmp/no-content.ts" })).toBeNull();
  });

  it("rewrites relative HTML preview resources through the artifact API path", () => {
    const rewritten = rewriteHtmlPreviewResourceUrls({
      content: [
        "<html><head>",
        "<link rel=\"stylesheet\" href=\"./app.css\">",
        "<link rel=\"canonical\" href=\"/docs\">",
        "<style>.hero{background:url('../img/bg.png')}</style>",
        "</head><body>",
        "<img src=\"images/chart.png\" srcset=\"small.png 1x, large.png 2x\">",
        "<video poster=\"/mnt/user-data/outputs/poster.png\"></video>",
        "<a href=\"report.html\">Report</a>",
        "</body></html>",
      ].join(""),
      currentHref: "http://localhost/workspace/chats/thread-a",
      url: "/api/threads/thread-a/artifacts/workspace/thread-a/site/index.html",
    });

    expect(rewritten).toContain(
      "href=\"http://localhost/api/threads/thread-a/artifacts/workspace/thread-a/site/app.css\"",
    );
    expect(rewritten).toContain("href=\"/docs\"");
    expect(rewritten).toContain(
      "url(http://localhost/api/threads/thread-a/artifacts/workspace/thread-a/img/bg.png)",
    );
    expect(rewritten).toContain(
      "src=\"http://localhost/api/threads/thread-a/artifacts/workspace/thread-a/site/images/chart.png\"",
    );
    expect(rewritten).toContain(
      "srcset=\"http://localhost/api/threads/thread-a/artifacts/workspace/thread-a/site/small.png 1x, http://localhost/api/threads/thread-a/artifacts/workspace/thread-a/site/large.png 2x\"",
    );
    expect(rewritten).toContain(
      "poster=\"http://localhost/api/threads/thread-a/artifacts/mnt/user-data/outputs/poster.png\"",
    );
    expect(rewritten).toContain("href=\"report.html\"");
  });

  it("collects, resolves, inlines, and instruments HTML preview resources", () => {
    const content = [
      "<html><head>",
      "<link rel=\"stylesheet\" href=\"./app.css\">",
      "<link rel=\"canonical\" href=\"/docs\">",
      "<style>.hero{background:url('./hero.png')}</style>",
      "</head><body>",
      "<img src=\"images/chart.png\" srcset=\"small.png 1x, large.png 2x\">",
      "</body></html>",
    ].join("");
    const url = "/api/threads/thread-a/artifacts/workspace/thread-a/site/index.html";

    expect(collectHtmlPreviewResourceUrls(content)).toEqual([
      "./hero.png",
      "./app.css",
      "images/chart.png",
      "small.png",
      "large.png",
    ]);
    expect(resolveHtmlPreviewResourceReference({
      currentHref: "http://localhost/workspace/chats/thread-a",
      url,
      value: "./app.css",
    })).toBe(
      "http://localhost/api/threads/thread-a/artifacts/workspace/thread-a/site/app.css",
    );

    const rewritten = rewriteHtmlPreviewResourceUrls({
      content,
      currentHref: "http://localhost/workspace/chats/thread-a",
      resourceUrlMap: new Map([
        [
          "http://localhost/api/threads/thread-a/artifacts/workspace/thread-a/site/app.css",
          "data:text/css;base64,Lmhlcm97fQ==",
        ],
      ]),
      url,
    });
    expect(rewritten).toContain("href=\"data:text/css;base64,Lmhlcm97fQ==\"");
    expect(rewritten).toContain("href=\"/docs\"");

    const scrollKey = "/workspace/thread-a/site/index.html";
    const withScroll = appendHtmlPreviewScrollRestoration(content, scrollKey);
    expect(withScroll).toContain("data-deerflow-artifact-scroll-restoration");
    expect(withScroll).toContain(createHtmlPreviewScrollKey(scrollKey));
    expect(appendHtmlPreviewScrollRestoration(withScroll, "ignored")).toBe(withScroll);
  });
});
