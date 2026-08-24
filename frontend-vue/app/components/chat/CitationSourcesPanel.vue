<!--
  【文件职责】     展开引用来源详情并复制单条 Markdown reference。
  【架构位置】     L3 消息 UI adapter
  【主要导出】     默认 CitationSourcesPanel 组件
  【依赖关系】     core/citations · core/clipboard · i18n
  【边界与注意】   来源只接收 core 已归一化的 http/https URL，并固定新窗口安全 rel。
-->

<script setup lang="ts">
import { Check, Copy, ExternalLink, Library } from "lucide-vue-next";
import { ref } from "vue";

import {
  formatCitationMarkdownReference,
  type CitationSource,
} from "@/core/citations/sources";
import { writeTextToClipboard } from "@/core/clipboard";

defineProps<{ sources: CitationSource[] }>();
const { $i18n } = useNuxtApp();
const copied = ref<string | null>(null);
async function copySource(source: CitationSource) {
  if (await writeTextToClipboard(formatCitationMarkdownReference(source))) {
    copied.value = source.id;
    setTimeout(() => {
      if (copied.value === source.id) copied.value = null;
    }, 2_000);
  }
}
</script>

<template>
  <details
    v-if="sources.length"
    class="border-border bg-muted/20 mt-3 rounded-md border text-xs"
    data-testid="citation-sources"
  >
    <summary
      class="text-muted-foreground flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden"
    >
      <Library :size="14" />
      {{ $i18n.t.value.citations.sourcesSummary(sources.length) }}
    </summary>
    <ol
      class="border-border divide-border max-h-80 divide-y overflow-y-auto border-t"
    >
      <li
        v-for="(source, index) in sources"
        :key="source.id"
        class="flex min-w-0 items-center gap-2 p-2"
      >
        <span class="text-muted-foreground w-5 text-right">{{
          index + 1
        }}</span>
        <a
          :href="source.url"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:bg-muted flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium">{{ source.title }}</span>
            <span class="text-muted-foreground block truncate">{{
              source.domain
            }}</span>
          </span>
          <span class="text-muted-foreground shrink-0">{{
            $i18n.t.value.citations.citeCount(source.count)
          }}</span>
          <ExternalLink :size="13" />
        </a>
        <button
          type="button"
          class="text-muted-foreground rounded p-1.5"
          :aria-label="$i18n.t.value.citations.copyReference(source.title)"
          @click="copySource(source)"
        >
          <Check v-if="copied === source.id" :size="14" />
          <Copy v-else :size="14" />
        </button>
      </li>
    </ol>
  </details>
</template>
