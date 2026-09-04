<!--
  【文件职责】     展开引用来源详情并复制单条 Markdown reference。
  【架构位置】     L3 消息 UI adapter
  【主要导出】     默认 CitationSourcesPanel 组件
  【依赖关系】     core/citations · core/clipboard · i18n
  【边界与注意】   来源只接收 core 已归一化的 http/https URL，并固定新窗口安全 rel。
-->

<script setup lang="ts">
import { BookOpenText, Check, Copy, ExternalLink } from "lucide-vue-next";
import { ref } from "vue";

import {
  formatCitationMarkdownReference,
  type CitationSource,
} from "@/core/citations/sources";
import { writeTextToClipboard } from "@/core/clipboard";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

defineProps<{ sources: CitationSource[] }>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();
const copied = ref<string | null>(null);
/*
  复制成功/失败都要说一句（上游 citation-sources-panel.tsx:100/105）。
  本仓此前只换图标——图标是 `aria-hidden` 的装饰，读屏器**什么都听不到**，
  失败时更是一点反馈都没有。
*/
async function copySource(source: CitationSource) {
  if (!(await writeTextToClipboard(formatCitationMarkdownReference(source)))) {
    toast.error($i18n.t.value.clipboard.failedToCopyToClipboard);
    return;
  }
  toast.success($i18n.t.value.clipboard.copiedToClipboard);
  copied.value = source.id;
  setTimeout(() => {
    if (copied.value === source.id) copied.value = null;
  }, 2_000);
}
</script>

<template>
  <details
    v-if="sources.length"
    class="border-border bg-muted/20 mt-3 rounded-md border text-xs"
    data-testid="citation-sources"
  >
    <!--
      上游 citation-sources-panel.tsx:40 那颗是 `BookOpenTextIcon`
      （`size-3.5 shrink-0`），不是 `Library`——**两颗画的不是一回事**，
      而可访问性树里图标不出现，只有 `icon-parity` 的字形档看得见。
      `hover:text-foreground transition-colors` 也是上游那一行的：
      这是一条可点的 summary，本仓原来悬停没有任何反馈。
    -->
    <summary
      class="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 px-3 py-2 transition-colors [&::-webkit-details-marker]:hidden"
    >
      <BookOpenText :size="14" class="shrink-0" />
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
          <!-- 上游 citation-sources-panel.tsx:69 是 `size-3.5` = 14px。 -->
          <ExternalLink :size="14" />
        </a>
        <!--
          复制之后按钮的名字要跟着换（上游 :126 是
          `aria-label={copied ? copiedLabel : copyLabel}`）。本仓此前恒为
          「Copy reference…」，而唯一会变的图标是 aria-hidden 的装饰——
          读屏器听不出复制到底成没成。
        -->
        <!--
          **上游这一颗也是手写 `<button>`**（citation-sources-panel.tsx:122），
          所以不改走 Button；本仓照抄时漏掉的是三样：
          `hover:bg-muted hover:text-foreground transition-colors`
          （原来悬停时完全没有反应）、`shrink-0`（长标题会把它挤扁），
          以及复制成功那颗对勾的 **`text-green-500`**——上游变绿，
          本仓恒为 muted，用户看不出复制成没成（可访问名换了，视觉没换）。
          `title` 也补上：上游同时给了 aria-label 和 title。
        -->
        <button
          type="button"
          class="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded p-1.5 transition-colors"
          :aria-label="
            copied === source.id
              ? $i18n.t.value.citations.copiedReference(source.title)
              : $i18n.t.value.citations.copyReference(source.title)
          "
          :title="
            copied === source.id
              ? $i18n.t.value.citations.copiedReference(source.title)
              : $i18n.t.value.citations.copyReference(source.title)
          "
          @click="copySource(source)"
        >
          <Check
            v-if="copied === source.id"
            :size="14"
            class="text-green-500"
          />
          <Copy v-else :size="14" />
        </button>
      </li>
    </ol>
  </details>
</template>
