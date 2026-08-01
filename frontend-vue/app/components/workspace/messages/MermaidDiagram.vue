<script lang="ts">
import {
  Fragment,
  defineComponent,
  h,
  onMounted,
  ref,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue";
import type { MermaidConfig } from "mermaid";

const SAFE_SVG_TAGS = new Set([
  "a",
  "circle",
  "clipPath",
  "defs",
  "desc",
  "ellipse",
  "g",
  "line",
  "linearGradient",
  "marker",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "stop",
  "style",
  "svg",
  "text",
  "title",
  "tspan",
]);
const SAFE_SVG_ATTRIBUTES = new Set([
  "alignment-baseline",
  "aria-hidden",
  "aria-label",
  "aria-labelledby",
  "class",
  "clip-path",
  "cx",
  "cy",
  "d",
  "dominant-baseline",
  "fill",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "height",
  "id",
  "marker-end",
  "marker-mid",
  "marker-start",
  "offset",
  "opacity",
  "points",
  "preserveAspectRatio",
  "r",
  "role",
  "rx",
  "ry",
  "stroke",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-width",
  "style",
  "text-anchor",
  "transform",
  "viewBox",
  "width",
  "x",
  "x1",
  "x2",
  "xmlns",
  "y",
  "y1",
  "y2",
]);
const SAFE_URL_PROTOCOLS = ["http:", "https:", "mailto:"];
const MERMAID_CONFIG: MermaidConfig = {
  securityLevel: "strict",
  startOnLoad: false,
};

let mermaidIdCounter = 0;
let mermaidApiPromise: Promise<typeof import("mermaid").default> | null = null;

export default defineComponent({
  name: "MermaidDiagram",
  props: {
    reveal: {
      default: false,
      type: Boolean,
    },
    source: {
      required: true,
      type: String,
    },
  },
  setup(props) {
    const diagramId = `vue-message-mermaid-${(mermaidIdCounter += 1)}`;
    const status = ref<"idle" | "loading" | "success" | "error">("idle");
    const errorMessage = ref("");
    const svgNodes = shallowRef<VNodeChild[]>([]);
    let mounted = false;
    let renderGeneration = 0;

    async function renderDiagram() {
      const source = props.source.trim();
      renderGeneration += 1;
      const generation = renderGeneration;
      errorMessage.value = "";
      svgNodes.value = [];

      if (!source) {
        status.value = "error";
        errorMessage.value = "Mermaid 图表为空";
        return;
      }

      status.value = "loading";
      try {
        const mermaid = await loadMermaidApi();
        const result = await mermaid.render(`${diagramId}-${generation}`, source);
        if (generation !== renderGeneration) {
          return;
        }
        svgNodes.value = renderTrustedSvg(result.svg);
        status.value = "success";
      } catch (error) {
        if (generation !== renderGeneration) {
          return;
        }
        status.value = "error";
        errorMessage.value = error instanceof Error ? error.message : "Mermaid 渲染失败";
      }
    }

    onMounted(() => {
      mounted = true;
      void renderDiagram();
    });

    watch(
      () => props.source,
      () => {
        if (mounted) {
          void renderDiagram();
        }
      },
    );

    return () =>
      h(
        "figure",
        {
          class: [
            "rich-message-content__mermaid",
            props.reveal ? "rich-message-content__streaming-reveal" : "",
          ],
          "data-testid": props.reveal ? "vue-message-streaming-reveal" : "vue-message-mermaid",
        },
        [
          h("figcaption", { class: "rich-message-content__mermaid-caption" }, [
            h(
              "span",
              { "data-testid": "vue-message-mermaid-language" },
              "Mermaid 图表",
            ),
          ]),
          status.value === "success"
            ? h(
                "div",
                {
                  "aria-label": "Mermaid chart",
                  class: "rich-message-content__mermaid-chart",
                  "data-testid": "vue-message-mermaid-chart",
                },
                svgNodes.value,
              )
            : h(
                "div",
                {
                  "aria-busy": status.value === "loading" ? "true" : undefined,
                  class: "rich-message-content__mermaid-fallback",
                  "data-testid": "vue-message-mermaid-fallback",
                },
                [
                  h(
                    "p",
                    { class: "rich-message-content__mermaid-status" },
                    status.value === "loading"
                      ? "正在渲染 Mermaid 图表..."
                      : `Mermaid 渲染失败：${errorMessage.value}`,
                  ),
                  h("pre", { class: "rich-message-content__code-block" }, [
                    h("code", null, props.source),
                  ]),
                ],
              ),
        ],
      );
  },
});

async function loadMermaidApi(): Promise<typeof import("mermaid").default> {
  if (!mermaidApiPromise) {
    mermaidApiPromise = import("mermaid").then((module) => {
      module.default.initialize(MERMAID_CONFIG);
      return module.default;
    });
  }
  return mermaidApiPromise;
}

function renderTrustedSvg(svg: string): VNodeChild[] {
  if (typeof DOMParser === "undefined") {
    return [stripTags(svg)];
  }
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (document.querySelector("parsererror")) {
    return [stripTags(svg)];
  }
  return Array.from(document.childNodes).map(renderSvgNode);
}

function renderSvgNode(node: ChildNode): VNodeChild {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as Element;
  const tagName = element.tagName;
  const normalizedTagName = tagName.toLowerCase();
  const children = Array.from(element.childNodes).map(renderSvgNode);
  if (!SAFE_SVG_TAGS.has(normalizedTagName)) {
    return h(Fragment, null, children);
  }
  return h(tagName, readSafeSvgAttributes(element), children);
}

function readSafeSvgAttributes(element: Element): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name;
    const normalizedName = name.toLowerCase();
    if (normalizedName.startsWith("on")) {
      continue;
    }
    if (normalizedName === "href" || normalizedName === "xlink:href") {
      if (isSafeSvgHref(attribute.value)) {
        attributes[name] = attribute.value;
      }
      continue;
    }
    if (normalizedName === "style" && !isSafeStyle(attribute.value)) {
      continue;
    }
    if (SAFE_SVG_ATTRIBUTES.has(name) || normalizedName.startsWith("data-")) {
      attributes[name] = attribute.value;
    }
  }
  return attributes;
}

function isSafeSvgHref(href: string): boolean {
  if (href.startsWith("#")) {
    return true;
  }
  if (/^(\/\/|\\\\)/.test(href)) {
    return false;
  }
  try {
    const parsed = new URL(href, "https://dummy.example/");
    return SAFE_URL_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isSafeStyle(style: string): boolean {
  return !/(?:url\s*\(|expression\s*\()/i.test(style);
}

function stripTags(svg: string): string {
  return svg.replace(/<[^>]*>/g, "");
}
</script>
