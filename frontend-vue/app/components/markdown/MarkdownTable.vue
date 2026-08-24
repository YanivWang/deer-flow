<script setup lang="ts">
/*
  【文件职责】     Markdown 表格容器及复制、下载、全屏控制。
  【架构位置】     L2 markdown rendering
  【主要导出】     默认 MarkdownTable 组件
  【依赖关系】     DOM table extraction · Clipboard API · Blob download · ui/dialog · ui/dropdown-menu
  【边界与注意】   数据只从最终渲染的 table DOM 提取，保持与自定义单元格渲染一致。
*/
import { computed, inject, onUnmounted, ref, useAttrs } from "vue";
import { Check, Copy, Download, Maximize2 } from "lucide-vue-next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markdownStreamingKey } from "@/core/markdown/rendering-context";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{ class?: string }>(), { class: "" });
const attrs = useAttrs();
const { $i18n } = useNuxtApp();
const table = ref<HTMLTableElement | null>(null);
const fullscreen = ref(false);
const copied = ref(false);
const streaming = inject(
  markdownStreamingKey,
  computed(() => false),
);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

const tableAttrs = computed(() => {
  const { node: _node, class: _class, ...rest } = attrs;
  void _node;
  void _class;
  return rest;
});

interface TableData {
  headers: string[];
  rows: string[][];
}

function extractTableData(): TableData {
  const element = table.value;
  if (!element) return { headers: [], rows: [] };
  return {
    headers: [...element.querySelectorAll("thead th")].map(
      (cell) => cell.textContent?.trim() ?? "",
    ),
    rows: [...element.querySelectorAll("tbody tr")].map((row) =>
      [...row.querySelectorAll("td")].map(
        (cell) => cell.textContent?.trim() ?? "",
      ),
    ),
  };
}

function markdownCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

function asMarkdown(data: TableData) {
  const width = Math.max(
    data.headers.length,
    ...data.rows.map((row) => row.length),
  );
  const headers = Array.from({ length: width }, (_, index) =>
    markdownCell(data.headers[index] ?? ""),
  );
  const rows = data.rows.map((row) =>
    Array.from({ length: width }, (_, index) => markdownCell(row[index] ?? "")),
  );
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function asCsv(data: TableData) {
  return [data.headers, ...data.rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

function asTsv(data: TableData) {
  return [data.headers, ...data.rows]
    .map((row) => row.map((value) => value.replaceAll("\t", " ")).join("\t"))
    .join("\n");
}

function serialized(format: "markdown" | "csv" | "tsv") {
  const data = extractTableData();
  if (format === "csv") return asCsv(data);
  if (format === "tsv") return asTsv(data);
  return asMarkdown(data);
}

async function copyTable(format: "markdown" | "csv" | "tsv") {
  if (streaming.value) return;
  try {
    await navigator.clipboard.writeText(serialized(format));
    copied.value = true;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copied.value = false;
    }, 2_000);
  } catch {
    // Clipboard rejection is non-fatal and leaves the table usable.
  }
}

function downloadTable(format: "markdown" | "csv") {
  if (streaming.value) return;
  const markdown = format === "markdown";
  const content = serialized(format);
  const blob = new Blob([content], {
    type: markdown ? "text/markdown;charset=utf-8" : "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = markdown ? "table.md" : "table.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

onUnmounted(() => {
  if (copiedTimer) clearTimeout(copiedTimer);
});
</script>

<template>
  <div
    class="border-border bg-sidebar my-4 flex flex-col gap-2 rounded-lg border p-2"
    data-streamdown="table-wrapper"
  >
    <div class="flex items-center justify-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger :disabled="streaming">
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-all disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="streaming"
            :aria-label="$i18n.t.value.markdown.copyTable"
            :title="$i18n.t.value.markdown.copyTable"
          >
            <Check v-if="copied" :size="14" />
            <Copy v-else :size="14" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            :title="$i18n.t.value.markdown.copyTableAsMarkdown"
            @select="copyTable('markdown')"
          >
            {{ $i18n.t.value.markdown.tableFormatMarkdown }}
          </DropdownMenuItem>
          <DropdownMenuItem
            :title="$i18n.t.value.markdown.copyTableAsCsv"
            @select="copyTable('csv')"
          >
            {{ $i18n.t.value.markdown.tableFormatCsv }}
          </DropdownMenuItem>
          <DropdownMenuItem
            :title="$i18n.t.value.markdown.copyTableAsTsv"
            @select="copyTable('tsv')"
          >
            {{ $i18n.t.value.markdown.tableFormatTsv }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger :disabled="streaming">
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-all disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="streaming"
            :aria-label="$i18n.t.value.markdown.downloadTable"
            :title="$i18n.t.value.markdown.downloadTable"
          >
            <Download :size="14" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            :title="$i18n.t.value.markdown.downloadTableAsCsv"
            @select="downloadTable('csv')"
          >
            {{ $i18n.t.value.markdown.tableFormatCsv }}
          </DropdownMenuItem>
          <DropdownMenuItem
            :title="$i18n.t.value.markdown.downloadTableAsMarkdown"
            @select="downloadTable('markdown')"
          >
            {{ $i18n.t.value.markdown.tableFormatMarkdown }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-all disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="streaming"
        :aria-label="$i18n.t.value.markdown.viewFullscreen"
        :title="$i18n.t.value.markdown.viewFullscreen"
        @click="fullscreen = true"
      >
        <Maximize2 :size="14" />
      </button>
    </div>
    <div class="border-border bg-background overflow-auto rounded-md border">
      <table
        ref="table"
        v-bind="tableAttrs"
        :class="['divide-border w-full divide-y', props.class]"
        data-streamdown="table"
      >
        <slot />
      </table>
    </div>
  </div>
  <Dialog v-model:open="fullscreen">
    <DialogContent
      class="inset-0 top-0 left-0 flex h-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none"
      :close-label="$i18n.t.value.markdown.exitFullscreen"
    >
      <DialogTitle class="sr-only">
        {{ $i18n.t.value.markdown.viewFullscreen }}
      </DialogTitle>
      <DialogDescription class="sr-only">
        {{ $i18n.t.value.markdown.viewFullscreen }}
      </DialogDescription>
      <div class="flex-1 overflow-auto p-4 pt-14">
        <table
          class="border-border w-full border-collapse border"
          data-streamdown="table"
        >
          <slot />
        </table>
      </div>
    </DialogContent>
  </Dialog>
</template>
