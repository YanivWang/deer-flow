<script setup lang="ts">
/*
  【文件职责】     展示 Memory document，并编排严格导入、搜索筛选与事实 CRUD。
  【架构位置】     L3 product UI
  【主要导出】     默认 MemorySettings 组件
  【依赖关系】     useMemory · memory schema/view-model · SettingsActionDialog
  【边界与注意】   import 先纯校验再预览确认；所有写操作以 Gateway 完整响应回填单一 query cache。
*/

import { computed, reactive, ref } from "vue";

import SettingsActionDialog from "@/components/workspace/settings/SettingsActionDialog.vue";
import { useMemory } from "@/composables/useMemory";
import {
  parseMemoryImportText,
  type MemoryImportWarning,
} from "@/core/memory/schema";
import type { MemoryFact, UserMemory } from "@/core/memory/types";
import {
  buildMemoryFactCreateInput,
  buildMemoryFactPatchInput,
  filterMemory,
  truncateMemoryFact,
  validateMemoryFactForm,
  type MemoryFactForm,
  type MemoryViewFilter,
} from "@/core/memory/view-model";

interface PendingImport {
  fileName: string;
  memory: UserMemory;
  warnings: MemoryImportWarning[];
}

const { $i18n } = useNuxtApp();
const t = computed(() => $i18n.t.value);
const owner = useMemory();
const importInput = ref<HTMLInputElement | null>(null);
const query = ref("");
const filter = ref<MemoryViewFilter>("all");
const pageError = ref("");
const importError = ref("");
const pendingImport = ref<PendingImport | null>(null);
const clearDialogOpen = ref(false);
const clearError = ref("");
const factToDelete = ref<MemoryFact | null>(null);
const deleteError = ref("");
const factToEdit = ref<MemoryFact | null>(null);
const factEditorOpen = ref(false);
const factFormError = ref("");
const factForm = reactive<MemoryFactForm>({
  content: "",
  category: "context",
  confidence: "0.8",
});

const summaryTitles = computed(() => ({
  workContext: t.value.settings.memory.markdown.work,
  personalContext: t.value.settings.memory.markdown.personal,
  topOfMind: t.value.settings.memory.markdown.topOfMind,
  recentMonths: t.value.settings.memory.markdown.recentMonths,
  earlierContext: t.value.settings.memory.markdown.earlierContext,
  longTermBackground: t.value.settings.memory.markdown.longTermBackground,
}));
const visible = computed(() =>
  owner.memory.value
    ? filterMemory(
        owner.memory.value,
        query.value,
        filter.value,
        summaryTitles.value,
      )
    : { summaries: [], facts: [], empty: false, noMatches: false },
);
const pendingSummaryCount = computed(() => {
  const memory = pendingImport.value?.memory;
  if (!memory) return 0;
  return [
    memory.user.workContext,
    memory.user.personalContext,
    memory.user.topOfMind,
    memory.history.recentMonths,
    memory.history.earlierContext,
    memory.history.longTermBackground,
  ].filter((section) => section.summary.trim()).length;
});
const importExtraCount = computed(
  () =>
    pendingImport.value?.warnings.filter(
      (warning) => warning.code === "extra-field",
    ).length ?? 0,
);
const importDuplicateCount = computed(
  () =>
    pendingImport.value?.warnings.filter(
      (warning) => warning.code === "duplicate-fact-content",
    ).length ?? 0,
);
const factPending = computed(
  () => owner.create.isPending.value || owner.update.isPending.value,
);

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function resetFactForm() {
  factToEdit.value = null;
  factForm.content = "";
  factForm.category = "context";
  factForm.confidence = "0.8";
  factFormError.value = "";
}

function openCreateFact() {
  resetFactForm();
  factEditorOpen.value = true;
}

function openEditFact(fact: MemoryFact) {
  factToEdit.value = fact;
  factForm.content = fact.content;
  factForm.category = fact.category;
  factForm.confidence = String(fact.confidence);
  factFormError.value = "";
  factEditorOpen.value = true;
}

function closeFactEditor() {
  if (factPending.value) return;
  factEditorOpen.value = false;
  resetFactForm();
}

async function saveFact() {
  if (factPending.value) return;
  const validation = validateMemoryFactForm(factForm);
  if (!validation.ok) {
    factFormError.value =
      validation.field === "content"
        ? t.value.settings.memory.factValidationContent
        : t.value.settings.memory.factValidationConfidence;
    return;
  }
  factFormError.value = "";
  try {
    if (factToEdit.value) {
      const input = buildMemoryFactPatchInput(factToEdit.value, factForm);
      if (Object.keys(input).length > 0) {
        await owner.update.mutateAsync({ factId: factToEdit.value.id, input });
      }
    } else {
      await owner.create.mutateAsync(buildMemoryFactCreateInput(factForm));
    }
    closeFactEditor();
  } catch (cause) {
    factFormError.value = errorMessage(cause, t.value.settings.memory.factSave);
  }
}

async function selectImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file) return;
  importError.value = "";
  try {
    const validation = parseMemoryImportText(await file.text());
    if (!validation.ok) {
      const first = validation.issues[0];
      importError.value = t.value.settings.memory.importSchemaIssue(
        first?.code ?? "invalid",
        first?.path ?? "$",
      );
      return;
    }
    pendingImport.value = {
      fileName: file.name,
      memory: validation.memory,
      warnings: validation.warnings,
    };
  } catch (cause) {
    importError.value = errorMessage(
      cause,
      t.value.settings.memory.importInvalidFile,
    );
  }
}

function cancelImport() {
  if (owner.importDocument.isPending.value) return;
  pendingImport.value = null;
  importError.value = "";
}

async function confirmImport() {
  const pending = pendingImport.value;
  if (!pending || owner.importDocument.isPending.value) return;
  importError.value = "";
  try {
    await owner.importDocument.mutateAsync(pending.memory);
    pendingImport.value = null;
  } catch (cause) {
    importError.value = errorMessage(
      cause,
      t.value.settings.memory.importInvalidFile,
    );
  }
}

async function exportDocument() {
  if (owner.exportDocument.isPending.value) return;
  pageError.value = "";
  try {
    const memory = await owner.exportDocument.mutateAsync();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(memory, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `deerflow-memory-${(memory.lastUpdated || new Date().toISOString()).replaceAll(/[:.]/g, "-")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch (cause) {
    pageError.value = errorMessage(cause, t.value.common.exportFailed);
  }
}

async function confirmClear() {
  if (owner.clear.isPending.value) return;
  clearError.value = "";
  try {
    await owner.clear.mutateAsync();
    clearDialogOpen.value = false;
  } catch (cause) {
    clearError.value = errorMessage(cause, t.value.settings.memory.clearAll);
  }
}

function openDelete(fact: MemoryFact) {
  deleteError.value = "";
  factToDelete.value = fact;
}

async function confirmDelete() {
  const fact = factToDelete.value;
  if (!fact || owner.remove.isPending.value) return;
  deleteError.value = "";
  try {
    await owner.remove.mutateAsync(fact.id);
    factToDelete.value = null;
  } catch (cause) {
    deleteError.value = errorMessage(cause, t.value.common.delete);
  }
}
</script>

<template>
  <section class="space-y-5" data-testid="memory-settings">
    <header>
      <h2 class="text-lg font-semibold">{{ t.settings.memory.title }}</h2>
      <p class="text-muted-foreground text-sm">
        {{ t.settings.memory.description }}
      </p>
    </header>

    <p v-if="owner.loading.value" class="text-muted-foreground text-sm">
      {{ t.common.loading }}
    </p>
    <p v-else-if="owner.error.value" role="alert" class="text-sm text-red-600">
      {{ errorMessage(owner.error.value, t.settings.memory.empty) }}
    </p>
    <template v-else-if="owner.memory.value">
      <div class="space-y-3">
        <div class="flex flex-col gap-2 sm:flex-row">
          <input
            v-model="query"
            type="search"
            :placeholder="t.settings.memory.searchPlaceholder"
            class="border-input min-w-0 flex-1 rounded-md border px-3 py-2"
            data-testid="memory-search"
          />
          <div class="flex gap-1" role="group">
            <button
              v-for="option in ['all', 'facts', 'summaries'] as const"
              :key="option"
              type="button"
              class="rounded-md border px-3 py-2 text-sm"
              :class="filter === option ? 'bg-accent' : ''"
              @click="filter = option"
            >
              {{
                option === "all"
                  ? t.settings.memory.filterAll
                  : option === "facts"
                    ? t.settings.memory.filterFacts
                    : t.settings.memory.filterSummaries
              }}
            </button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-md border px-3 py-2 text-sm"
            :disabled="owner.importDocument.isPending.value"
            data-testid="memory-import-open"
            @click="importInput?.click()"
          >
            {{ t.settings.memory.importButton }}
          </button>
          <input
            ref="importInput"
            type="file"
            accept=".json,application/json"
            class="hidden"
            data-testid="memory-import-file"
            @change="selectImport"
          />
          <button
            type="button"
            class="rounded-md border px-3 py-2 text-sm"
            :disabled="owner.exportDocument.isPending.value"
            @click="exportDocument"
          >
            {{ t.settings.memory.exportButton }}
          </button>
          <button
            type="button"
            class="rounded-md border px-3 py-2 text-sm"
            data-testid="memory-add-fact"
            @click="openCreateFact"
          >
            {{ t.settings.memory.addFact }}
          </button>
          <button
            type="button"
            class="ml-auto rounded-md bg-red-600 px-3 py-2 text-sm text-white"
            data-testid="memory-clear-open"
            @click="
              clearError = '';
              clearDialogOpen = true;
            "
          >
            {{ t.settings.memory.clearAll }}
          </button>
        </div>
        <p v-if="importError" role="alert" class="text-sm text-red-600">
          {{ importError }}
        </p>
        <p v-if="pageError" role="alert" class="text-sm text-red-600">
          {{ pageError }}
        </p>
      </div>

      <p
        v-if="visible.empty"
        class="text-muted-foreground rounded-md border border-dashed p-4 text-sm"
        data-testid="memory-empty"
      >
        {{ t.settings.memory.memoryFullyEmpty }}
      </p>
      <p
        v-else-if="visible.noMatches"
        class="text-muted-foreground rounded-md border border-dashed p-4 text-sm"
        data-testid="memory-no-matches"
      >
        {{ t.settings.memory.noMatches }}
      </p>

      <div
        v-if="filter !== 'facts' && visible.summaries.length"
        class="space-y-3"
      >
        <p class="text-muted-foreground text-sm">
          {{ t.settings.memory.summaryReadOnly }}
        </p>
        <article
          v-for="entry in visible.summaries"
          :key="entry.key"
          class="rounded-md border p-3"
          data-testid="memory-summary"
        >
          <h3 class="font-medium">{{ entry.title }}</h3>
          <p class="mt-1 text-sm whitespace-pre-wrap">{{ entry.summary }}</p>
          <p v-if="entry.updatedAt" class="text-muted-foreground mt-2 text-xs">
            {{ t.common.lastUpdated }}: {{ entry.updatedAt }}
          </p>
        </article>
      </div>

      <div v-if="filter !== 'summaries'" class="space-y-2">
        <h3 class="font-medium">{{ t.settings.memory.markdown.facts }}</h3>
        <p
          v-if="visible.facts.length === 0 && !visible.noMatches"
          class="text-muted-foreground text-sm"
        >
          {{ t.settings.memory.noFacts }}
        </p>
        <article
          v-for="fact in visible.facts"
          :key="fact.id"
          class="flex items-start justify-between gap-3 rounded-md border p-3"
          :data-testid="`memory-fact-${fact.id}`"
        >
          <div class="min-w-0">
            <p class="text-sm break-words">{{ fact.content }}</p>
            <p class="text-muted-foreground mt-1 text-xs">
              {{ t.settings.memory.markdown.table.category }}:
              {{ fact.category }} · {{ t.settings.memory.factConfidenceLabel }}:
              {{ fact.confidence }} ·
              {{ t.settings.memory.markdown.table.createdAt }}:
              {{ fact.createdAt || "-" }} ·
              {{ t.settings.memory.markdown.table.source }}:
              {{
                fact.source === "manual"
                  ? t.settings.memory.manualFactSource
                  : fact.source
              }}
            </p>
          </div>
          <div class="flex shrink-0 gap-2">
            <button
              type="button"
              class="text-sm underline"
              :aria-label="`${t.common.edit}: ${fact.content}`"
              @click="openEditFact(fact)"
            >
              {{ t.common.edit }}
            </button>
            <button
              type="button"
              class="text-sm text-red-600 underline"
              :aria-label="`${t.common.delete}: ${fact.content}`"
              @click="openDelete(fact)"
            >
              {{ t.common.delete }}
            </button>
          </div>
        </article>
      </div>
    </template>
    <p v-else class="text-muted-foreground text-sm">
      {{ t.settings.memory.empty }}
    </p>
  </section>

  <SettingsActionDialog
    :open="pendingImport !== null"
    :title="t.settings.memory.importConfirmTitle"
    :description="t.settings.memory.importConfirmDescription"
    :confirm-label="t.common.import"
    :cancel-label="t.common.cancel"
    :pending="owner.importDocument.isPending.value"
    data-testid="memory-import-dialog"
    @cancel="cancelImport"
    @confirm="confirmImport"
  >
    <div
      v-if="pendingImport"
      class="bg-muted space-y-1 rounded-md border p-3 text-sm"
    >
      <div>
        {{ t.settings.memory.importFileLabel }}: {{ pendingImport.fileName }}
      </div>
      <div>{{ t.common.version }}: {{ pendingImport.memory.version }}</div>
      <div>
        {{ t.common.lastUpdated }}:
        {{ pendingImport.memory.lastUpdated || "-" }}
      </div>
      <div>
        {{ t.settings.memory.filterSummaries }}: {{ pendingSummaryCount }}
      </div>
      <div>
        {{ t.settings.memory.filterFacts }}:
        {{ pendingImport.memory.facts.length }}
      </div>
      <div
        v-if="importExtraCount"
        class="text-amber-700"
        data-testid="memory-import-extra-warning"
      >
        {{ t.settings.memory.importExtraWarning(importExtraCount) }}
      </div>
      <div
        v-if="importDuplicateCount"
        class="text-amber-700"
        data-testid="memory-import-duplicate-warning"
      >
        {{
          t.settings.memory.importDuplicateContentWarning(importDuplicateCount)
        }}
      </div>
    </div>
    <p v-if="importError" role="alert" class="text-sm text-red-600">
      {{ importError }}
    </p>
  </SettingsActionDialog>

  <SettingsActionDialog
    :open="clearDialogOpen"
    :title="t.settings.memory.clearAllConfirmTitle"
    :description="t.settings.memory.clearAllConfirmDescription"
    :confirm-label="t.settings.memory.clearAll"
    :cancel-label="t.common.cancel"
    :pending="owner.clear.isPending.value"
    destructive
    data-testid="memory-clear-dialog"
    @cancel="!owner.clear.isPending.value && (clearDialogOpen = false)"
    @confirm="confirmClear"
  >
    <p v-if="clearError" role="alert" class="text-sm text-red-600">
      {{ clearError }}
    </p>
  </SettingsActionDialog>

  <SettingsActionDialog
    :open="factToDelete !== null"
    :title="t.settings.memory.factDeleteConfirmTitle"
    :description="t.settings.memory.factDeleteConfirmDescription"
    :confirm-label="t.common.delete"
    :cancel-label="t.common.cancel"
    :pending="owner.remove.isPending.value"
    destructive
    data-testid="memory-delete-dialog"
    @cancel="!owner.remove.isPending.value && (factToDelete = null)"
    @confirm="confirmDelete"
  >
    <div v-if="factToDelete" class="bg-muted rounded-md border p-3 text-sm">
      <div class="text-muted-foreground mb-1 font-medium">
        {{ t.settings.memory.factPreviewLabel }}
      </div>
      {{ truncateMemoryFact(factToDelete.content) }}
    </div>
    <p v-if="deleteError" role="alert" class="text-sm text-red-600">
      {{ deleteError }}
    </p>
  </SettingsActionDialog>

  <SettingsActionDialog
    :open="factEditorOpen"
    :title="
      factToEdit
        ? t.settings.memory.editFactTitle
        : t.settings.memory.addFactTitle
    "
    :confirm-label="t.settings.memory.factSave"
    :cancel-label="t.common.cancel"
    :pending="factPending"
    data-testid="memory-fact-dialog"
    @cancel="closeFactEditor"
    @confirm="saveFact"
  >
    <label class="block space-y-1 text-sm">
      <span>{{ t.settings.memory.factContentLabel }}</span>
      <textarea
        v-model="factForm.content"
        rows="4"
        class="border-input w-full rounded-md border p-2"
        :placeholder="t.settings.memory.factContentPlaceholder"
        data-testid="memory-fact-content"
      />
    </label>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block space-y-1 text-sm">
        <span>{{ t.settings.memory.factCategoryLabel }}</span>
        <input
          v-model="factForm.category"
          class="border-input w-full rounded-md border px-3 py-2"
          :placeholder="t.settings.memory.factCategoryPlaceholder"
          data-testid="memory-fact-category"
        />
      </label>
      <label class="block space-y-1 text-sm">
        <span>{{ t.settings.memory.factConfidenceLabel }}</span>
        <input
          v-model="factForm.confidence"
          type="number"
          min="0"
          max="1"
          step="0.01"
          class="border-input w-full rounded-md border px-3 py-2"
          data-testid="memory-fact-confidence"
        />
      </label>
    </div>
    <p class="text-muted-foreground text-xs">
      {{ t.settings.memory.factConfidenceHint }}
    </p>
    <p v-if="factFormError" role="alert" class="text-sm text-red-600">
      {{ factFormError }}
    </p>
  </SettingsActionDialog>
</template>
