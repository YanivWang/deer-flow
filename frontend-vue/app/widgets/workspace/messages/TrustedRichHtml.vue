<script lang="ts">
import { Fragment, defineComponent, h, type VNodeChild } from "vue";

const SAFE_TAGS = new Set([
  "a",
  "annotation",
  "br",
  "code",
  "del",
  "div",
  "em",
  "math",
  "mi",
  "mn",
  "mo",
  "mover",
  "mpadded",
  "mroot",
  "mrow",
  "mspace",
  "msqrt",
  "mstyle",
  "msub",
  "msubsup",
  "msup",
  "mtable",
  "mtd",
  "mtext",
  "mtr",
  "munderover",
  "p",
  "pre",
  "semantics",
  "span",
  "strong",
  "sub",
  "sup",
]);
const SAFE_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];

export default defineComponent({
  name: "TrustedRichHtml",
  props: {
    html: {
      required: true,
      type: String,
    },
  },
  setup(props) {
    return () => h(Fragment, null, renderTrustedHtml(props.html));
  },
});

function renderTrustedHtml(html: string): VNodeChild[] {
  if (typeof DOMParser === "undefined") {
    return [stripTags(html)];
  }
  const document = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return Array.from(document.body.childNodes).map(renderNode);
}

function renderNode(node: ChildNode): VNodeChild {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  const children = Array.from(element.childNodes).map(renderNode);
  if (!SAFE_TAGS.has(tagName)) {
    return h(Fragment, null, children);
  }
  return h(tagName, readSafeAttributes(element, tagName), children);
}

function readSafeAttributes(element: Element, tagName: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    if (name.startsWith("on")) {
      continue;
    }
    if (name === "href" && tagName === "a") {
      if (isSafeHref(attribute.value)) {
        attributes.href = attribute.value;
      }
      continue;
    }
    if (name === "style" && !isSafeStyle(attribute.value)) {
      continue;
    }
    if (
      name.startsWith("aria-") ||
      name === "class" ||
      name === "encoding" ||
      name === "rel" ||
      name === "style" ||
      name === "target" ||
      name === "title" ||
      name === "xmlns"
    ) {
      attributes[name] = attribute.value;
    }
  }
  if (tagName === "a" && attributes.href && /^https?:\/\//.test(attributes.href)) {
    attributes.target = "_blank";
    attributes.rel = "noopener noreferrer";
  }
  return attributes;
}

function isSafeStyle(style: string): boolean {
  return !/(?:url\s*\(|expression\s*\(|behavior\s*:|-moz-binding\s*:)/i.test(style);
}

function isSafeHref(href: string): boolean {
  if (href.startsWith("#") || href.startsWith("/")) {
    return true;
  }
  if (/^(\/\/|\\\\)/.test(href)) {
    return false;
  }
  try {
    const parsed = new URL(href, "https://dummy.example/");
    return SAFE_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}
</script>
