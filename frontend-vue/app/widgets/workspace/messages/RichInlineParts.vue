<script setup lang="ts">
import "katex/dist/katex.min.css";

import type { RichInlinePart } from "../../../core/messages/rich-content/index";
import MessageImage from "./MessageImage.vue";
import TrustedRichHtml from "./TrustedRichHtml.vue";

defineOptions({
  name: "RichInlineParts",
});

defineProps<{
  parts: RichInlinePart[];
}>();

function footnoteDomId(label: string): string {
  return encodeURIComponent(label);
}
</script>

<template>
  <template v-for="(part, index) in parts" :key="`${part.type}-${index}`">
    <span
      v-if="part.type === 'text'"
      :class="{ 'rich-message-content__streaming-reveal': part.reveal }"
      :data-testid="part.reveal ? 'vue-message-streaming-reveal' : undefined"
    >
      {{ part.text }}
    </span>
    <code
      v-else-if="part.type === 'code'"
      class="rich-message-content__inline-code"
      :class="{ 'rich-message-content__streaming-reveal': part.reveal }"
      :data-testid="part.reveal ? 'vue-message-streaming-reveal' : undefined"
    >
      {{ part.text }}
    </code>
    <br
      v-else-if="part.type === 'line-break'"
      class="rich-message-content__line-break"
      :class="{ 'rich-message-content__streaming-reveal': part.reveal }"
      :data-testid="part.reveal ? 'vue-message-streaming-reveal' : 'vue-message-line-break'"
    >
    <strong
      v-else-if="part.type === 'strong'"
      class="rich-message-content__strong"
      :class="{ 'rich-message-content__streaming-reveal': part.reveal }"
      :data-testid="part.reveal ? 'vue-message-streaming-reveal' : 'vue-message-strong'"
    >
      <RichInlineParts :parts="part.parts" />
    </strong>
    <em
      v-else-if="part.type === 'emphasis'"
      class="rich-message-content__emphasis"
      :class="{ 'rich-message-content__streaming-reveal': part.reveal }"
      :data-testid="part.reveal ? 'vue-message-streaming-reveal' : 'vue-message-emphasis'"
    >
      <RichInlineParts :parts="part.parts" />
    </em>
    <span
      v-else-if="part.type === 'strikethrough'"
      class="rich-message-content__strikethrough"
      :class="{ 'rich-message-content__streaming-reveal': part.reveal }"
      :data-testid="part.reveal ? 'vue-message-streaming-reveal' : 'vue-message-strikethrough'"
    >
      <del><RichInlineParts :parts="part.parts" /></del>
    </span>
    <span
      v-else-if="part.type === 'math'"
      class="rich-message-content__inline-math"
      :class="{ 'rich-message-content__streaming-reveal': part.reveal }"
      data-testid="vue-message-inline-math"
    >
      <TrustedRichHtml :html="part.html" />
    </span>
    <span
      v-else-if="part.type === 'html'"
      class="rich-message-content__inline-html"
      :class="{ 'rich-message-content__streaming-reveal': part.reveal }"
      data-testid="vue-message-inline-html"
    >
      <TrustedRichHtml :html="part.html" />
    </span>
    <sup
      v-else-if="part.type === 'footnote-ref'"
      class="rich-message-content__footnote-ref"
      :class="{ 'rich-message-content__streaming-reveal': part.reveal }"
      :data-testid="part.reveal ? 'vue-message-streaming-reveal' : 'vue-message-footnote-ref'"
    >
      <a
        :id="`fnref-${footnoteDomId(part.label)}`"
        :href="`#fn-${footnoteDomId(part.label)}`"
      >
        {{ part.index }}
      </a>
    </sup>
    <a
      v-else-if="part.type === 'link'"
      class="rich-message-content__link"
      :class="{
        'rich-message-content__link--citation': part.citationLabel,
        'rich-message-content__streaming-reveal': part.reveal,
      }"
      :data-testid="part.reveal ? 'vue-message-streaming-reveal' : part.citationLabel ? 'vue-message-citation-link' : 'vue-message-link'"
      :href="part.href"
      :target="part.external ? '_blank' : undefined"
      :rel="part.external ? 'noopener noreferrer' : undefined"
    >
      {{ part.citationLabel ?? part.label }}
    </a>
    <span
      v-else-if="part.type === 'unsafe-link'"
      class="rich-message-content__unsafe-link"
      :class="{ 'rich-message-content__streaming-reveal': part.reveal }"
      :data-testid="part.reveal ? 'vue-message-streaming-reveal' : 'vue-message-unsafe-link'"
      :title="`已忽略不安全链接协议：${part.href}`"
    >
      {{ part.label }}
    </span>
    <MessageImage
      v-else
      :alt="part.alt"
      :reveal="part.reveal"
      :src="part.src"
    />
  </template>
</template>
