<!--
  【文件职责】     统一渲染消息 Markdown 的安全、外部、artifact 与 citation 链接。
  【对应 frontend/】 frontend/src/components/workspace/messages/markdown-link.tsx
  【架构位置】     L3 message UI adapter
  【主要导出】     默认组件
  【依赖关系】     Reka HoverCard · core/markdown/links · core/artifacts/utils
  【边界与注意】   协议 allowlist 必须先于 citation/artifact 分支，危险 href 永不进入 anchor。
-->

<script setup lang="ts">
import {
  computed,
  inject,
  isVNode,
  useAttrs,
  useSlots,
  type VNodeChild,
} from "vue";
import { ExternalLink } from "lucide-vue-next";
import {
  HoverCardContent,
  HoverCardPortal,
  HoverCardRoot,
  HoverCardTrigger,
} from "reka-ui";

import { resolveMarkdownArtifactURL } from "@/core/artifacts/utils";
import {
  isExternalMarkdownHref,
  isSafeMarkdownHref,
} from "@/core/markdown/links";

import { MARKDOWN_LINK_CONTEXT } from "./markdown-link-context";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  href?: string;
  threadId?: string | null;
  isMock?: boolean;
  node?: unknown;
}>();
const attrs = useAttrs();
const slots = useSlots();
const context = inject(MARKDOWN_LINK_CONTEXT, null);
const threadId = computed(() => props.threadId ?? context?.threadId.value);
const isMock = computed(() => props.isMock ?? context?.isMock.value);

function extractVisibleText(node: VNodeChild): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(extractVisibleText).join("");
  if (!isVNode(node)) return "";
  if (typeof node.children === "string") return node.children;
  if (Array.isArray(node.children)) {
    return node.children.map(extractVisibleText).join("");
  }
  return "";
}

function domainOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./i, "");
  } catch {
    return href;
  }
}

const visibleText = computed(() =>
  (slots.default?.() ?? []).map(extractVisibleText).join(""),
);
const citationLabel = computed(() => {
  const match = /^citation:(.+)$/i.exec(visibleText.value);
  if (!match) return null;
  const label = match[1]!.trim();
  return label === "Source" || label === "来源"
    ? domainOf(props.href ?? "")
    : label;
});
const safe = computed(
  () => props.href === undefined || isSafeMarkdownHref(props.href),
);
const artifact = computed(() =>
  Boolean(threadId.value && props.href?.startsWith("/mnt/")),
);
const resolvedHref = computed(() =>
  artifact.value
    ? resolveMarkdownArtifactURL(props.href!, threadId.value!, {
        isMock: isMock.value,
      })
    : props.href,
);
const opensNewTab = computed(
  () =>
    citationLabel.value !== null ||
    artifact.value ||
    isExternalMarkdownHref(resolvedHref.value),
);
const target = computed(() =>
  typeof attrs.target === "string"
    ? attrs.target
    : opensNewTab.value
      ? "_blank"
      : undefined,
);
const rel = computed(() =>
  typeof attrs.rel === "string"
    ? attrs.rel
    : opensNewTab.value
      ? "noopener noreferrer"
      : undefined,
);
const forwardedAttrs = computed(() => {
  const {
    class: _class,
    href: _href,
    node: _node,
    rel: _rel,
    target: _target,
    ...rest
  } = attrs;
  return rest;
});
</script>

<template>
  <span
    v-if="!safe"
    v-bind="forwardedAttrs"
    data-message-markdown-link="blocked"
    aria-label="Unsafe link omitted"
    :title="`Unsafe link scheme in ${href}`"
    :class="[
      'text-muted-foreground cursor-not-allowed underline decoration-dotted underline-offset-2',
      attrs.class,
    ]"
  >
    <slot />
  </span>

  <HoverCardRoot v-else-if="citationLabel" :open-delay="0" :close-delay="0">
    <HoverCardTrigger as-child>
      <a
        v-bind="forwardedAttrs"
        :href="resolvedHref"
        :target="target"
        :rel="rel"
        data-message-markdown-link="citation"
        class="inline-flex items-center"
        @click.stop
      >
        <span
          class="bg-secondary text-secondary-foreground hover:bg-secondary/80 mx-0.5 inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs font-normal"
        >
          {{ citationLabel }}
          <ExternalLink :size="12" aria-hidden="true" />
        </span>
      </a>
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent
        :side-offset="4"
        class="bg-popover text-popover-foreground z-50 w-80 rounded-md border p-3 shadow-md"
      >
        <h4 class="truncate text-sm leading-tight font-medium">
          {{ citationLabel }}
        </h4>
        <p class="text-muted-foreground mt-1 truncate text-xs break-all">
          {{ resolvedHref }}
        </p>
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>

  <a
    v-else
    v-bind="forwardedAttrs"
    :href="resolvedHref"
    :target="target"
    :rel="rel"
    data-message-markdown-link="safe"
    :class="[
      'text-primary decoration-primary/30 hover:decoration-primary/60 underline underline-offset-2 transition-colors',
      attrs.class,
    ]"
  >
    <slot />
  </a>
</template>
