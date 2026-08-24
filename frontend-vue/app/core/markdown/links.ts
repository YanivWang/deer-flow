/*
  【文件职责】     定义 Markdown href 协议 allowlist 与外链判定纯规则。
  【架构位置】     L2 markdown
  【主要导出】     isSafeMarkdownHref · isExternalMarkdownHref
  【依赖关系】     Web URL 标准
  【边界与注意】   不认识 DeerFlow artifact/thread；业务 URL 解析由 L3 组件完成。
*/

const SAFE_HREF_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function isSafeMarkdownHref(href: string | undefined): boolean {
  if (typeof href !== "string" || href.length === 0) return false;
  if (href.startsWith("#")) return true;
  if (/^(\/\/|\\\\)/.test(href)) return false;

  try {
    return SAFE_HREF_PROTOCOLS.has(
      new URL(href, "https://dummy.example/").protocol,
    );
  } catch {
    return false;
  }
}

export function isExternalMarkdownHref(href: string | undefined): boolean {
  return typeof href === "string" && /^https?:\/\//.test(href);
}
