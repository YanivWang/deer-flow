<script setup lang="ts">
/*
  【文件职责】     在 run 最终 assistant 气泡显示 workspace changes。
  【对应 frontend/】 src/components/workspace/changes/workspace-changes-badge.tsx
  【架构位置】     L3 extension reference
  【主要导出】     默认 WorkspaceChangesBadge 组件
  【依赖关系】     workspace changes API · MessageList
  【边界与注意】   保留 B8/B9 锚点；是宿主扩展卡片而非 L2 内建业务。
*/
import { computed, ref, watch } from "vue";
import { ArrowUpRight, FileDiff, ExternalLink, X } from "lucide-vue-next";

import { resolveArtifactURL } from "@/core/artifacts/utils";
import { fetchWorkspaceChanges } from "@/core/workspace-changes/api";
import {
  getChangedFileCount,
  getWorkspaceChangeLineClass,
  sortWorkspaceChanges,
} from "@/core/workspace-changes/summary";
import type {
  WorkspaceChangesResponse,
  WorkspaceFileChange,
} from "@/core/workspace-changes/types";

const props = defineProps<{
  threadId: string;
  runId?: string;
  disabled?: boolean;
}>();
const summary = ref<WorkspaceChangesResponse | null>(null);
const details = ref<WorkspaceChangesResponse | null>(null);
const open = ref(false);
const loading = ref(false);

watch(
  () => [props.threadId, props.runId, props.disabled] as const,
  async ([threadId, runId, disabled], _previous, onCleanup) => {
    summary.value = null;
    details.value = null;
    if (!runId || disabled) return;
    let current = true;
    onCleanup(() => {
      current = false;
    });
    try {
      const result = await fetchWorkspaceChanges({
        threadId,
        runId,
        includeFiles: true,
        includeDiff: false,
      });
      if (current) summary.value = result;
    } catch {
      if (current) summary.value = null;
    }
  },
  { immediate: true },
);

const count = computed(() =>
  summary.value?.available ? getChangedFileCount(summary.value.summary) : 0,
);
const files = computed(() =>
  sortWorkspaceChanges((details.value ?? summary.value)?.files ?? []),
);

function compactPath(path: string) {
  return path
    .replace(/^\/mnt\/user-data\/workspace\//, "")
    .replace(/^\/mnt\/user-data\/outputs\//, "outputs/");
}
function lineClass(line: string) {
  const type = getWorkspaceChangeLineClass(line);
  if (type === "addition") return "bg-emerald-500/10 text-emerald-700";
  if (type === "deletion") return "bg-red-500/10 text-red-700";
  if (type === "hunk") return "bg-sky-500/10 text-sky-700";
  if (type === "meta") return "text-muted-foreground";
  return "text-foreground";
}
async function showDetails() {
  if (!props.runId) return;
  open.value = true;
  if (details.value) return;
  loading.value = true;
  try {
    details.value = await fetchWorkspaceChanges({
      threadId: props.threadId,
      runId: props.runId,
      includeFiles: true,
      includeDiff: true,
    });
  } finally {
    loading.value = false;
  }
}
function canOpen(file: WorkspaceFileChange) {
  return file.status !== "deleted" && !file.sensitive;
}
</script>

<template>
  <div
    v-if="count > 0 && summary"
    class="border-border/70 bg-muted/20 mt-3 overflow-hidden rounded-xl border"
  >
    <div class="border-border/70 flex items-center gap-3 border-b p-3">
      <div
        class="bg-background/80 flex size-10 shrink-0 items-center justify-center rounded-lg"
      >
        <FileDiff class="text-muted-foreground size-4" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-foreground text-sm font-semibold">
          Edited {{ count }} {{ count === 1 ? "file" : "files" }}
        </div>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground mt-0.5 inline-flex items-center gap-1 text-xs font-medium"
          @click="showDetails"
        >
          View changes <ArrowUpRight :size="12" />
        </button>
      </div>
      <span class="shrink-0 text-xs font-semibold tabular-nums">
        <span class="text-emerald-500">+{{ summary.summary.additions }}</span>
        <span class="ml-1 text-red-500">-{{ summary.summary.deletions }}</span>
      </span>
    </div>
    <div class="py-1">
      <div
        v-for="file in sortWorkspaceChanges(summary.files)"
        :key="`${file.status}:${file.path}`"
        class="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
      >
        <span class="min-w-0 truncate" :title="file.path">{{
          compactPath(file.path)
        }}</span>
        <span class="shrink-0 font-semibold tabular-nums">
          <span class="text-emerald-500">+{{ file.additions }}</span>
          <span class="ml-1 text-red-500">-{{ file.deletions }}</span>
        </span>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="open && summary"
      class="fixed inset-0 z-50 flex justify-end bg-black/35"
      @click.self="open = false"
    >
      <section
        class="bg-background flex h-full w-[min(92vw,900px)] flex-col shadow-2xl"
        aria-label="Workspace changes"
      >
        <header class="border-border flex items-start gap-3 border-b px-5 py-4">
          <FileDiff class="text-muted-foreground mt-1 size-4" />
          <div class="min-w-0 flex-1">
            <h2 class="font-semibold">Workspace changes</h2>
            <p class="text-muted-foreground text-sm">
              {{ count }} files · +{{ summary.summary.additions }} -{{
                summary.summary.deletions
              }}
            </p>
          </div>
          <button type="button" aria-label="Close" @click="open = false">
            <X :size="18" />
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <p v-if="loading" class="text-muted-foreground text-sm">Loading…</p>
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
                <span class="min-w-0 flex-1 font-mono text-xs">{{
                  file.path
                }}</span>
                <a
                  v-if="canOpen(file)"
                  :href="resolveArtifactURL(file.path, threadId)"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open file"
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
              <p
                v-else
                class="text-muted-foreground border-t px-3 py-3 text-xs"
              >
                Diff unavailable
              </p>
            </details>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
