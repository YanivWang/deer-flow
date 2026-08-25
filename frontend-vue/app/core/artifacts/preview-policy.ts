/*
  【文件职责】     HTML artifact 的完整文档与安全预览策略。
  【架构位置】     L3
  【主要导出】     isCompleteHtmlDocument / canRenderArtifactHtml
  【依赖关系】     无
  【边界与注意】   正式 Range 截断内容永不进入 iframe；write_file 流式前缀仅在未完成时例外。
*/

function firstTag(content: string, tag: string, closing = false) {
  const slash = closing ? String.raw`/\s*` : "";
  return content.search(
    new RegExp(String.raw`<\s*${slash}${tag}\b[^>]*>`, "i"),
  );
}

function hasBalancedRegion(content: string, tag: string) {
  const open = Array.from(
    content.matchAll(new RegExp(String.raw`<\s*${tag}\b[^>]*>`, "gi")),
  ).length;
  const close = Array.from(
    content.matchAll(new RegExp(String.raw`<\s*/\s*${tag}\s*>`, "gi")),
  ).length;
  return open === close;
}

export function isCompleteHtmlDocument(content: string) {
  const htmlOpen = firstTag(content, "html");
  const htmlClose = firstTag(content, "html", true);
  const bodyOpen = firstTag(content, "body");
  const bodyClose = firstTag(content, "body", true);
  if (
    htmlOpen < 0 ||
    bodyOpen < htmlOpen ||
    bodyClose < bodyOpen ||
    htmlClose < bodyClose
  ) {
    return false;
  }

  const headOpen = firstTag(content, "head");
  const headClose = firstTag(content, "head", true);
  if (
    (headOpen >= 0 || headClose >= 0) &&
    !(headOpen >= htmlOpen && headClose >= headOpen && bodyOpen >= headClose)
  ) {
    return false;
  }

  return ["style", "script"].every((tag) => hasBalancedRegion(content, tag));
}

export function canRenderArtifactHtml(options: {
  source: "formal" | "write-file-draft";
  content: string;
  truncated: boolean;
  fullContentLoaded: boolean;
  toolResult?: string;
}) {
  if (options.source === "formal") {
    return (
      !options.truncated &&
      options.fullContentLoaded &&
      isCompleteHtmlDocument(options.content)
    );
  }

  if (options.toolResult !== undefined) {
    return (
      options.toolResult.trim() === "OK" &&
      options.fullContentLoaded &&
      isCompleteHtmlDocument(options.content)
    );
  }

  return !options.truncated && !options.fullContentLoaded;
}
