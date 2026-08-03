<script setup lang="ts">
import "katex/dist/katex.min.css";

import { computed, onErrorCaptured, ref, watch } from "vue";

import {
  applyStreamingReveal,
  collectCitationSources,
  parseRichContent,
  type RichInlinePart,
  type RichContentBlock,
} from "../../../core/messages/rich-content/index";
import CodeBlock from "./CodeBlock.vue";
import MermaidDiagram from "./MermaidDiagram.vue";
import RichInlineParts from "./RichInlineParts.vue";
import TrustedRichHtml from "./TrustedRichHtml.vue";

const props = withDefaults(
  defineProps<{
    artifactPaths?: readonly string[];
    content: string;
    isLoading?: boolean;
    messageElement?: string | null;
    messageRole?: "ai" | "tool" | "error" | "unknown";
    streamingReveal?: boolean;
    threadId?: string;
  }>(),
  {
    artifactPaths: () => [],
    isLoading: false,
    messageElement: null,
    messageRole: "unknown",
    streamingReveal: false,
    threadId: undefined,
  },
);

const blocks = ref<RichContentBlock[]>([]);
const previousBlocks = ref<RichContentBlock[]>([]);
const rendererFailed = ref(false);
const lastGoodContent = ref(props.content);
const citationSources = computed(() => collectCitationSources(blocks.value));
const isTaskMessage = computed(() => props.messageElement === "task");
const isEmptyLoadingAssistant = computed(
  () => props.messageRole === "ai" && props.isLoading && !props.content && !props.messageElement,
);

onErrorCaptured(() => {
  rendererFailed.value = true;
  return false;
});

watch(
  () => [props.content, props.artifactPaths, props.threadId, props.streamingReveal] as const,
  () => {
    const parsedBlocks = parseRichContent(
      props.content,
      {
        artifactPaths: props.artifactPaths,
        threadId: props.threadId,
      },
      {
        streaming: props.streamingReveal,
      },
    );
    blocks.value = props.streamingReveal
      ? applyStreamingReveal(parsedBlocks, previousBlocks.value)
      : parsedBlocks;
    previousBlocks.value = parsedBlocks;
    lastGoodContent.value = props.content;
    rendererFailed.value = false;
  },
  { immediate: true },
);

function isTaskListItem(block: RichContentBlock, itemIndex: number): boolean {
  if (block.type !== "list") return false;
  return block.checkedItems?.[itemIndex] !== undefined && block.checkedItems[itemIndex] !== null;
}

function isTaskListItemChecked(block: RichContentBlock, itemIndex: number): boolean {
  return block.type === "list" && block.checkedItems?.[itemIndex] === true;
}

function isHiddenStreamingListItem(block: RichContentBlock, itemIndex: number): boolean {
  if (block.type !== "list" && block.type !== "ordered-list") return false;
  return block.hiddenItems?.[itemIndex] === true;
}

function isRevealedStreamingListItem(block: RichContentBlock, itemIndex: number): boolean {
  if (block.type !== "list" && block.type !== "ordered-list") return false;
  return block.revealItems?.[itemIndex] === true;
}

function tableAlignmentClass(block: RichContentBlock, columnIndex: number): string | undefined {
  if (block.type !== "table") return undefined;
  const alignment = block.alignments?.[columnIndex];
  return alignment ? `rich-message-content__table-cell--align-${alignment}` : undefined;
}

function footnoteDomId(label: string): string {
  return encodeURIComponent(label);
}

function headingId(parts: RichInlinePart[]): string {
  return parts
    .filter((part) => part.type === "text" || part.type === "code")
    .map((part) => part.text)
    .join("")
    .trim()
    .replace(/\s+/g, "-");
}
</script>

<template>
  <div
    class="rich-message-content"
    :class="{
      'rich-message-content--error': props.messageRole === 'error',
      'rich-message-content--tool': props.messageRole === 'tool',
    }"
    data-testid="vue-rich-message-content"
    :data-message-role="props.messageRole"
  >
    <div
      v-if="isTaskMessage"
      class="rich-message-content__task"
      data-testid="vue-message-task"
    >
      <span class="rich-message-content__task-spinner">⟳</span>
      <span>{{ props.content || "正在处理文件…" }}</span>
    </div>
    <pre
      v-else-if="rendererFailed"
      class="rich-message-content__renderer-fallback"
      data-testid="vue-message-renderer-fallback"
    >{{ lastGoodContent }}</pre>
    <div
      v-else-if="isEmptyLoadingAssistant"
      class="rich-message-content__loading"
      data-testid="vue-message-loading"
      role="status"
    >正在生成…</div>
    <template v-for="(block, index) in blocks" v-else :key="`${block.type}-${index}`">
      <p
        v-if="block.type === 'paragraph'"
        class="rich-message-content__paragraph"
        data-testid="vue-message-paragraph"
      ><RichInlineParts :parts="block.parts" /></p>
      <component
        :is="`h${block.level}`"
        v-else-if="block.type === 'heading'"
        :id="headingId(block.parts)"
        class="rich-message-content__heading"
        :data-level="block.level"
        data-testid="vue-message-heading"
      ><RichInlineParts :parts="block.parts" /></component>
      <blockquote
        v-else-if="block.type === 'blockquote'"
        class="rich-message-content__blockquote"
        data-testid="vue-message-blockquote"
      ><RichInlineParts :parts="block.parts" /></blockquote>
      <hr
        v-else-if="block.type === 'thematic-break'"
        class="rich-message-content__thematic-break"
        :class="{ 'rich-message-content__streaming-reveal': block.reveal }"
        data-testid="vue-message-thematic-break"
      >
      <ul
        v-else-if="block.type === 'list'"
        class="rich-message-content__list"
        :class="{ 'rich-message-content__list--task': block.checkedItems }"
        data-testid="vue-message-list"
      >
        <li
          v-for="(item, itemIndex) in block.items"
          :key="itemIndex"
          :class="{
            'rich-message-content__task-item': isTaskListItem(block, itemIndex),
            'rich-message-content__streaming-list-item': isRevealedStreamingListItem(block, itemIndex),
          }"
          :hidden="isHiddenStreamingListItem(block, itemIndex)"
          :data-streaming-list-item="isRevealedStreamingListItem(block, itemIndex) ? 'true' : undefined"
        >
          <input
            v-if="isTaskListItem(block, itemIndex)"
            class="rich-message-content__task-checkbox"
            type="checkbox"
            :checked="isTaskListItemChecked(block, itemIndex)"
            disabled
            data-testid="vue-message-task-checkbox"
          >
          <RichInlineParts :parts="item" />
        </li>
      </ul>
      <ol
        v-else-if="block.type === 'ordered-list'"
        class="rich-message-content__list"
        data-testid="vue-message-ordered-list"
      >
        <li
          v-for="(item, itemIndex) in block.items"
          :key="itemIndex"
          :class="{ 'rich-message-content__streaming-list-item': isRevealedStreamingListItem(block, itemIndex) }"
          :hidden="isHiddenStreamingListItem(block, itemIndex)"
          :data-streaming-list-item="isRevealedStreamingListItem(block, itemIndex) ? 'true' : undefined"
        ><RichInlineParts :parts="item" /></li>
      </ol>
      <div
        v-else-if="block.type === 'table'"
        class="rich-message-content__table-wrap"
        data-testid="vue-message-table"
      >
        <table class="rich-message-content__table">
          <thead><tr><th
            v-for="(header, headerIndex) in block.headers"
            :key="headerIndex"
            :class="tableAlignmentClass(block, headerIndex)"
            :data-align="block.alignments?.[headerIndex] || undefined"
          ><RichInlineParts :parts="header" /></th></tr></thead>
          <tbody><tr v-for="(row, rowIndex) in block.rows" :key="rowIndex">
            <td
              v-for="(cell, cellIndex) in row"
              :key="cellIndex"
              :class="tableAlignmentClass(block, cellIndex)"
              :data-align="block.alignments?.[cellIndex] || undefined"
            ><RichInlineParts :parts="cell" /></td>
          </tr></tbody>
        </table>
      </div>
      <CodeBlock
        v-else-if="block.type === 'code'"
        :code="block.code"
        :language="block.language"
        :reveal="block.reveal"
        :streaming="props.streamingReveal"
      />
      <MermaidDiagram
        v-else-if="block.type === 'mermaid'"
        :reveal="block.reveal"
        :source="block.code"
      />
      <section
        v-else-if="block.type === 'footnotes'"
        class="rich-message-content__footnotes"
        data-testid="vue-message-footnotes"
      ><ol><li
        v-for="item in block.items"
        :id="`fn-${footnoteDomId(item.label)}`"
        :key="item.label"
        class="rich-message-content__footnote-item"
      ><RichInlineParts :parts="item.parts" /><a
        class="rich-message-content__footnote-backref"
        :href="`#fnref-${footnoteDomId(item.label)}`"
      >↩</a></li></ol></section>
      <div
        v-else
        class="rich-message-content__math-block"
        :class="{ 'rich-message-content__streaming-reveal': block.reveal }"
        :data-testid="block.reveal ? 'vue-message-streaming-reveal' : 'vue-message-math-block'"
      ><TrustedRichHtml :html="block.html" /></div>
    </template>
    <aside
      v-if="citationSources.length > 0 && !isTaskMessage"
      class="rich-message-content__citations"
      data-testid="vue-message-citation-sources"
    >
      <h3>引用</h3>
      <ol><li v-for="source in citationSources" :key="`${source.label}-${source.href}`">
        <a :href="source.href">{{ source.label }}</a>
      </li></ol>
    </aside>
  </div>
</template>
