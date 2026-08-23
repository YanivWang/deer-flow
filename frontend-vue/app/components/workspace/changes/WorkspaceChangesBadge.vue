<script setup lang="ts">
/*
  【文件职责】     在 run 最终 assistant 气泡显示完整 workspace-change summary/detail。
  【对应 frontend/】 workspace-changes-badge.tsx · workspace-changes-panel.tsx
  【架构位置】     L3 extension reference
  【主要导出】     默认 WorkspaceChangesBadge 组件
  【依赖关系】     useWorkspaceChanges · presentation/summary · artifact URL
  【边界与注意】   server state 仅由 useWorkspaceChanges/TanStack Query 持有。
*/
import { computed, ref, watch } from "vue";
import { ArrowUpRight, ExternalLink, FileDiff, X } from "lucide-vue-next";

import { useWorkspaceChanges } from "@/composables/useWorkspaceChanges";
import { resolveArtifactURL } from "@/core/artifacts/utils";
import {
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
      class="mt-2 underline"
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
    <div class="border-border/70 flex items-center gap-3 border-b p-3">
      <div
        class="bg-background/80 flex size-10 shrink-0 items-center justify-center rounded-lg"
      >
        <FileDiff class="text-muted-foreground size-4" />
      </div>
      <div class="min-w-0 flex-1">
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
          class="text-muted-foreground hover:text-foreground mt-0.5 inline-flex items-center gap-1 text-xs font-medium"
          @click="open = true"
        >
          {{ $i18n.t.value.workspaceChanges.viewChanges }}
          <ArrowUpRight :size="12" />
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
        <span class="min-w-0 flex-1 truncate" :title="file.path">
          {{ compactPath(file.path) }}
        </span>
        <span class="text-muted-foreground shrink-0 text-xs">
          {{ statusText(file) }}
        </span>
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
        :aria-label="$i18n.t.value.workspaceChanges.title"
      >
        <header class="border-border flex items-start gap-3 border-b px-5 py-4">
          <FileDiff class="text-muted-foreground mt-1 size-4" />
          <div class="min-w-0 flex-1">
            <h2 class="font-semibold">
              {{ $i18n.t.value.workspaceChanges.title }}
            </h2>
            <p class="text-muted-foreground text-sm">
              {{ count }} files · +{{ summary.summary.additions }} -{{
                summary.summary.deletions
              }}
            </p>
          </div>
          <button
            type="button"
            :aria-label="$i18n.t.value.common.close"
            @click="open = false"
          >
            <X :size="18" />
          </button>
        </header>
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
              class="mt-2 underline"
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
      </section>
    </div>
  </Teleport>
</template>
