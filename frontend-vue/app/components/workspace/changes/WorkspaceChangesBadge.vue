<script setup lang="ts">
/*
  【文件职责】     在 run 最终 assistant 气泡显示完整 workspace-change summary/detail。
  【架构位置】     L3 extension reference
  【主要导出】     默认 WorkspaceChangesBadge 组件
  【依赖关系】     useWorkspaceChanges · presentation/summary · artifact URL · ui/sheet
  【边界与注意】   server state 仅由 useWorkspaceChanges/TanStack Query 持有。

                   **折叠态那张卡片上没有状态词。** 上游 `workspace-change-badge.tsx`
                   的 summary 行只有「路径 + 增删数」，`Created` / `Modified` 这些字
                   只出现在展开后的面板里。S7 要求的「完整显示 status」由面板那一层
                   满足，卡片上再写一遍是本仓多出来的——它让同一行在两个应用里读出来
                   不是同一句（对照台账上就是那条
                   `+8-2 outputs/report.md Modified +1-1`）。

                   增删数两边都是「两个 span」，但上游用 `inline-flex ... gap-1`
                   而这里原来用 `ml-1`：gap 产生的是**布局间隙**，会进可访问性树的
                   文本拼接（`+8 -2`），margin 不会（`+8-2`）。看起来只是空格，
                   读屏器念出来是两个数字还是一个数字。
*/
import { computed, ref, watch } from "vue";
import { ArrowUpRight, ExternalLink, FileDiff } from "lucide-vue-next";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useWorkspaceChanges } from "@/composables/useWorkspaceChanges";
import { resolveArtifactURL } from "@/core/artifacts/utils";
import {
  formatWorkspacePath,
  workspaceChangeReasonKey,
  workspaceChangeStatusKey,
} from "@/core/workspace-changes/presentation";
import {
  getChangedFileCount,
  getWorkspaceChangeLineClass,
  sortWorkspaceChanges,
} from "@/core/workspace-changes/summary";
import type { WorkspaceFileChange } from "@/core/workspace-changes/types";

const props = defineProps<{
  threadId: string;
  runId?: string;
  disabled?: boolean;
}>();
const { $i18n } = useNuxtApp();
const open = ref(false);
const summaryOwner = useWorkspaceChanges({
  threadId: computed(() => props.threadId),
  runId: computed(() => props.runId),
  includeFiles: true,
  includeDiff: false,
  enabled: computed(() => Boolean(props.runId && !props.disabled)),
});
const detailOwner = useWorkspaceChanges({
  threadId: computed(() => props.threadId),
  runId: computed(() => props.runId),
  includeFiles: true,
  includeDiff: true,
  enabled: computed(() =>
    Boolean(open.value && props.runId && !props.disabled),
  ),
});

const summary = computed(() => summaryOwner.data.value);
const details = computed(() => detailOwner.data.value);
const count = computed(() =>
  summary.value?.available ? getChangedFileCount(summary.value.summary) : 0,
);
const files = computed(() =>
  sortWorkspaceChanges((details.value ?? summary.value)?.files ?? []),
);
const summaryError = computed(() => errorMessage(summaryOwner.error.value));
const detailError = computed(() => errorMessage(detailOwner.error.value));

watch(
  () => [props.threadId, props.runId] as const,
  () => {
    open.value = false;
  },
);

function errorMessage(error: unknown) {
  if (!error) return null;
  return error instanceof Error && error.message.trim()
    ? error.message
    : $i18n.t.value.workspaceChanges.loadFailed;
}

function lineClass(line: string) {
  const type = getWorkspaceChangeLineClass(line);
  if (type === "addition") return "bg-emerald-500/10 text-emerald-700";
  if (type === "deletion") return "bg-red-500/10 text-red-700";
  if (type === "hunk") return "bg-sky-500/10 text-sky-700";
  if (type === "meta") return "text-muted-foreground";
  return "text-foreground";
}

function statusText(file: WorkspaceFileChange) {
  return $i18n.t.value.workspaceChanges[workspaceChangeStatusKey(file.status)];
}

function reasonText(file: WorkspaceFileChange) {
  return $i18n.t.value.workspaceChanges[
    workspaceChangeReasonKey(file.diff_unavailable_reason)
  ];
}

function canOpen(file: WorkspaceFileChange) {
  return file.status !== "deleted" && !file.sensitive;
}
</script>

<template>
  <div
    v-if="summaryError && !summary"
    class="border-destructive/30 bg-destructive/5 text-destructive mt-3 rounded-xl border p-3 text-sm"
    role="alert"
    data-testid="workspace-changes-summary-error"
  >
    <p>{{ summaryError }}</p>
    <button
      type="button"
      class="mt-2 underline disabled:pointer-events-none disabled:opacity-50"
      :disabled="summaryOwner.fetching.value"
      @click="summaryOwner.refetch()"
    >
      {{ $i18n.t.value.workspaceChanges.retry }}
    </button>
  </div>

  <div
    v-else-if="count > 0 && summary"
    class="border-border/70 bg-muted/20 mt-3 overflow-hidden rounded-xl border"
  >
    <div
      class="border-border/70 flex items-center justify-between gap-3 border-b p-3"
    >
      <div class="flex min-w-0 items-center gap-2.5">
        <div
          class="bg-background/80 flex size-10 shrink-0 items-center justify-center rounded-lg"
        >
          <FileDiff class="text-muted-foreground size-4" />
        </div>
        <div class="min-w-0">
          <div class="text-foreground text-sm font-semibold">
            {{ $i18n.t.value.workspaceChanges.editedTitle(count) }}
          </div>
          <p
            v-if="summary.summary.truncated"
            class="mt-0.5 text-xs text-amber-700"
          >
            {{ $i18n.t.value.workspaceChanges.truncatedSummary }}
          </p>
          <button
            data-testid="workspace-changes-open"
            type="button"
            class="text-muted-foreground hover:text-foreground mt-0.5 inline-flex items-center gap-1 text-xs font-medium transition-colors"
            @click="open = true"
          >
            {{ $i18n.t.value.workspaceChanges.viewChanges }}
            <ArrowUpRight :size="12" />
          </button>
        </div>
      </div>
      <span
        class="hidden shrink-0 items-center gap-1 text-xs font-semibold tabular-nums sm:inline-flex"
      >
        <span class="text-emerald-500">+{{ summary.summary.additions }}</span>
        <span class="text-red-500">-{{ summary.summary.deletions }}</span>
      </span>
    </div>
    <div class="py-1">
      <div
        v-for="file in sortWorkspaceChanges(summary.files)"
        :key="`${file.status}:${file.path}`"
        class="flex items-center justify-between gap-3 px-3 py-2.5"
      >
        <div class="min-w-0 truncate text-sm" :title="file.path">
          <span
            v-if="formatWorkspacePath(file.path).dirname"
            class="text-muted-foreground"
            >{{ formatWorkspacePath(file.path).dirname }}/</span
          ><span class="text-foreground font-medium">{{
            formatWorkspacePath(file.path).basename
          }}</span>
        </div>
        <span
          class="inline-flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums"
        >
          <span class="text-emerald-500">+{{ file.additions }}</span>
          <span class="text-red-500">-{{ file.deletions }}</span>
        </span>
      </div>
    </div>
  </div>

  <Sheet v-model:open="open">
    <SheetContent
      v-if="summary"
      class="w-[min(92vw,900px)] gap-0 p-0 sm:max-w-none"
      :close-label="$i18n.t.value.primitives.close"
    >
      <SheetHeader
        class="border-border flex-row items-start gap-3 border-b px-5 py-4 pr-14"
      >
        <FileDiff class="text-muted-foreground mt-1 size-4 shrink-0" />
        <div class="min-w-0 flex-1">
          <SheetTitle>{{ $i18n.t.value.workspaceChanges.title }}</SheetTitle>
          <SheetDescription>
            {{
              $i18n.t.value.workspaceChanges.badge(
                count,
                summary.summary.additions,
                summary.summary.deletions,
              )
            }}
          </SheetDescription>
        </div>
      </SheetHeader>
      <div class="min-h-0 flex-1 overflow-y-auto p-5">
        <p
          v-if="detailOwner.loading.value"
          class="text-muted-foreground text-sm"
        >
          {{ $i18n.t.value.workspaceChanges.loading }}
        </p>
        <div
          v-if="detailError"
          role="alert"
          class="border-destructive/30 bg-destructive/5 text-destructive mb-4 rounded-lg border p-3 text-sm"
        >
          <p>{{ detailError }}</p>
          <button
            data-testid="workspace-changes-retry"
            type="button"
            class="mt-2 underline disabled:pointer-events-none disabled:opacity-50"
            :disabled="detailOwner.fetching.value"
            @click="detailOwner.refetch()"
          >
            {{ $i18n.t.value.workspaceChanges.retry }}
          </button>
        </div>
        <p
          v-if="!detailOwner.loading.value && !files.length"
          class="text-muted-foreground text-sm"
        >
          {{ $i18n.t.value.workspaceChanges.noChanges }}
        </p>
        <div v-else class="flex flex-col gap-3">
          <details
            v-for="file in files"
            :key="`${file.status}:${file.path}`"
            class="border-border rounded-lg border"
            :open="Boolean(file.diff)"
          >
            <summary
              role="button"
              class="flex cursor-pointer list-none items-start gap-2 px-3 py-2"
            >
              <span class="min-w-0 flex-1">
                <span class="block font-mono text-xs">{{ file.path }}</span>
                <span
                  v-if="!file.diff"
                  class="text-muted-foreground mt-1 block text-xs"
                >
                  {{ reasonText(file) }}
                </span>
              </span>
              <span class="text-muted-foreground shrink-0 text-xs">
                {{ statusText(file) }}
              </span>
              <a
                v-if="canOpen(file)"
                :href="resolveArtifactURL(file.path, threadId)"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="$i18n.t.value.workspaceChanges.openFile"
                @click.stop
              >
                <ExternalLink :size="14" />
              </a>
            </summary>
            <pre
              v-if="file.diff"
              class="border-border max-h-[520px] overflow-auto border-t py-2 font-mono text-xs leading-5"
            ><span
                  v-for="(line, index) in file.diff.split('\n')"
                  :key="`${index}:${line}`"
                  :class="['block min-w-max px-3 whitespace-pre', lineClass(line)]"
                  >{{ line || " " }}</span
                ></pre>
          </details>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
