const RESOURCE_LINK_RELS = new Set([
  "apple-touch-icon",
  "icon",
  "manifest",
  "modulepreload",
  "preload",
  "stylesheet",
]);

export const HTML_PREVIEW_SCROLL_MESSAGE_SOURCE = "deerflow-artifact-preview-scroll";

export function rewriteHtmlPreviewResourceUrls({
  content,
  currentHref = globalThis.location?.href ?? "http://localhost/",
  resourceUrlMap = new Map<string, string>(),
  url,
}: {
  content: string;
  currentHref?: string;
  resourceUrlMap?: ReadonlyMap<string, string>;
  url: string | null | undefined;
}): string {
  if (!url) {
    return content;
  }

  const baseHref = htmlBaseHref(url, currentHref);
  const withStyleBlocks = content.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (_match, openTag: string, css: string, closeTag: string) =>
      `${openTag}${rewriteCssResourceUrls(css, baseHref, resourceUrlMap)}${closeTag}`,
  );

  return withStyleBlocks.replace(
    /<\s*[a-z][\w:-]*(?:\s+(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>/gi,
    (tag) => rewriteHtmlResourceTag(tag, baseHref, resourceUrlMap),
  );
}

export function collectHtmlPreviewResourceUrls(content: string): string[] {
  const urls = new Set<string>();
  content.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (_match, _openTag: string, css: string) => {
      for (const url of collectCssResourceUrls(css)) {
        urls.add(url);
      }
      return "";
    },
  );
  content.replace(
    /<\s*[a-z][\w:-]*(?:\s+(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>/gi,
    (tag) => {
      for (const url of collectHtmlResourceTagUrls(tag)) {
        urls.add(url);
      }
      return "";
    },
  );
  return [...urls];
}

export function resolveHtmlPreviewResourceReference({
  currentHref = globalThis.location?.href ?? "http://localhost/",
  url,
  value,
}: {
  currentHref?: string;
  url: string | null | undefined;
  value: string;
}): string {
  if (!url) {
    return value;
  }
  return resolveHtmlPreviewResourceUrl(value, htmlBaseHref(url, currentHref), new Map());
}

export function createHtmlPreviewScrollKey(scrollKey: string): string {
  let hash = 2166136261;
  for (let index = 0; index < scrollKey.length; index += 1) {
    hash ^= scrollKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `artifact-scroll:${(hash >>> 0).toString(36)}`;
}

export function appendHtmlPreviewScrollRestoration(
  content: string,
  scrollKey = "default",
): string {
  if (content.includes("data-deerflow-artifact-scroll-restoration")) {
    return content;
  }
  const script = htmlScrollRestorationScript(createHtmlPreviewScrollKey(scrollKey));

  if (/<head(?:\s[^>]*)?>/i.test(content)) {
    return content.replace(/<head(?:\s[^>]*)?>/i, (headTag) => `${headTag}${script}`);
  }
  if (/<\/body\s*>/i.test(content)) {
    return content.replace(/<\/body\s*>/i, `${script}</body>`);
  }
  return `${content}${script}`;
}

function escapeJavaScriptString(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003C")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function htmlScrollRestorationScript(messageKey: string): string {
  return `<script data-deerflow-artifact-scroll-restoration>
(() => {
  const source = ${escapeJavaScriptString(HTML_PREVIEW_SCROLL_MESSAGE_SOURCE)};
  const key = ${escapeJavaScriptString(messageKey)};
  const post = (type, payload = {}) => {
    window.parent.postMessage({ source, key, type, ...payload }, "*");
  };
  const save = () => {
    post("save", {
      x: Math.round(window.scrollX || 0),
      y: Math.round(window.scrollY || 0),
    });
  };
  const restore = (x, y) => {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      window.scrollTo(x, y);
    }
  };
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (
      !data ||
      data.source !== source ||
      data.key !== key ||
      data.type !== "restore"
    ) {
      return;
    }
    restore(data.x, data.y);
  });
  window.addEventListener("scroll", save, { passive: true });
  window.addEventListener("pagehide", save);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => post("restore-request"), { once: true });
  } else {
    post("restore-request");
  }
  window.addEventListener("load", () => post("restore-request"), { once: true });
})();
</script>`;
}

function htmlBaseHref(url: string, currentHref: string): string {
  const baseUrl = new URL(url, currentHref);
  baseUrl.pathname = baseUrl.pathname.replace(/\/[^/]*$/, "/");
  baseUrl.search = "";
  baseUrl.hash = "";
  return baseUrl.toString();
}

function rewriteHtmlResourceTag(
  tag: string,
  baseHref: string,
  resourceUrlMap: ReadonlyMap<string, string>,
): string {
  const tagName = /^<\s*([a-z][\w:-]*)/i.exec(tag)?.[1]?.toLowerCase();
  if (!tagName) {
    return tag;
  }

  const rewritesHref =
    tagName === "link"
    && getHtmlAttribute(tag, "rel")
      ?.toLowerCase()
      .split(/\s+/)
      .some((rel) => RESOURCE_LINK_RELS.has(rel));

  return tag.replace(
    /(\s)(src|poster|srcset|href|style)(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi,
    (match, prefix: string, name: string, separator: string, raw: string) => {
      const lowerName = name.toLowerCase();
      if (lowerName === "href" && !rewritesHref) {
        return match;
      }

      const { quote, value } = parseHtmlAttributeValue(raw);
      const next =
        lowerName === "srcset"
          ? rewriteSrcsetResourceUrls(value, baseHref, resourceUrlMap)
          : lowerName === "style"
            ? rewriteCssResourceUrls(value, baseHref, resourceUrlMap)
            : resolveHtmlPreviewResourceUrl(value, baseHref, resourceUrlMap);
      if (next === value) {
        return match;
      }
      return `${prefix}${name}${separator}${formatHtmlAttributeValue(next, quote)}`;
    },
  );
}

function getHtmlAttribute(tag: string, name: string): string | undefined {
  const match = new RegExp(
    String.raw`\s${name}\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>` + "`" + String.raw`]+)`,
    "i",
  ).exec(tag);
  return match?.[1] ? parseHtmlAttributeValue(match[1]).value : undefined;
}

function parseHtmlAttributeValue(raw: string): { quote: string; value: string } {
  const quote = raw.startsWith("\"") ? "\"" : raw.startsWith("'") ? "'" : "";
  return {
    quote,
    value: quote ? raw.slice(1, -1) : raw,
  };
}

function formatHtmlAttributeValue(value: string, quote: string): string {
  if (quote === "'") {
    return `'${value.replaceAll("'", "&#39;")}'`;
  }
  return `"${value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;")}"`;
}

function collectHtmlResourceTagUrls(tag: string): string[] {
  const tagName = /^<\s*([a-z][\w:-]*)/i.exec(tag)?.[1]?.toLowerCase();
  if (!tagName) {
    return [];
  }

  const rewritesHref =
    tagName === "link"
    && getHtmlAttribute(tag, "rel")
      ?.toLowerCase()
      .split(/\s+/)
      .some((rel) => RESOURCE_LINK_RELS.has(rel));
  const urls: string[] = [];
  tag.replace(
    /(\s)(src|poster|srcset|href|style)(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi,
    (_match, _prefix: string, name: string, _separator: string, raw: string) => {
      const lowerName = name.toLowerCase();
      if (lowerName === "href" && !rewritesHref) {
        return "";
      }

      const { value } = parseHtmlAttributeValue(raw);
      if (lowerName === "srcset") {
        for (const srcsetUrl of collectSrcsetResourceUrls(value)) {
          urls.push(srcsetUrl);
        }
        return "";
      }
      if (lowerName === "style") {
        urls.push(...collectCssResourceUrls(value));
        return "";
      }
      urls.push(value);
      return "";
    },
  );
  return urls;
}

function resolveHtmlPreviewResourceUrl(
  value: string,
  baseHref: string,
  resourceUrlMap: ReadonlyMap<string, string>,
): string {
  const trimmed = value.trim();
  if (!trimmed || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(trimmed)) {
    return resourceUrlMap.get(trimmed) ?? value;
  }

  const artifactApiPrefix = /^(.*\/artifacts)(?:\/.*)?$/.exec(baseHref)?.[1];
  if (artifactApiPrefix && trimmed.startsWith("/mnt/user-data/")) {
    const resolved = `${artifactApiPrefix}${trimmed}`;
    return resourceUrlMap.get(resolved) ?? resolved;
  }

  try {
    const resolved = new URL(trimmed, baseHref).toString();
    return resourceUrlMap.get(resolved) ?? resolved;
  } catch {
    return value;
  }
}

function rewriteSrcsetResourceUrls(
  value: string,
  baseHref: string,
  resourceUrlMap: ReadonlyMap<string, string>,
): string {
  if (/\bdata:/i.test(value)) {
    return value;
  }
  return value
    .split(",")
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/);
      if (!parts[0]) {
        return candidate;
      }
      return [
        resolveHtmlPreviewResourceUrl(parts[0], baseHref, resourceUrlMap),
        ...parts.slice(1),
      ].join(" ");
    })
    .join(", ");
}

function collectSrcsetResourceUrls(value: string): string[] {
  if (/\bdata:/i.test(value)) {
    return [];
  }
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter((url): url is string => Boolean(url));
}

function collectCssResourceUrls(value: string): string[] {
  const urls: string[] = [];
  value.replace(
    /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*))\s*\)/gi,
    (_match, doubleQuoted: string, singleQuoted: string, bare: string) => {
      urls.push(doubleQuoted ?? singleQuoted ?? bare ?? "");
      return "";
    },
  );
  return urls;
}

function rewriteCssResourceUrls(
  value: string,
  baseHref: string,
  resourceUrlMap: ReadonlyMap<string, string>,
): string {
  return value.replace(
    /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*))\s*\)/gi,
    (match, doubleQuoted: string, singleQuoted: string, bare: string) => {
      const raw = doubleQuoted ?? singleQuoted ?? bare ?? "";
      const next = resolveHtmlPreviewResourceUrl(raw, baseHref, resourceUrlMap);
      return next === raw ? match : `url(${next.replaceAll(")", "%29")})`;
    },
  );
}
