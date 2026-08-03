import { computed, ref, type MaybeRefOrGetter } from "vue";

import { useMemorySettings } from "./use-memory-settings";
import type { MemoryFact, UserMemory } from "../../../core/api/memory/client";

export function useSettingsMemory(enabled: MaybeRefOrGetter<boolean> = true) {
  const memorySettings = useMemorySettings(enabled);
  const memoryFactContent = ref("");
  const memoryFactCategory = ref("context");
  const memoryFactConfidence = ref("0.8");
  const memoryFormError = ref("");
  const memoryEditFactId = ref<string | null>(null);
  const memoryEditContent = ref("");
  const memoryEditCategory = ref("");
  const memoryEditConfidence = ref("0.8");
  const memoryImportText = ref("");
  const memoryExportText = ref("");

  const memoryLoadErrorMessage = computed(() =>
    memorySettings.query.error.value instanceof Error
      ? memorySettings.query.error.value.message
      : "",
  );

  async function submitMemoryFact() {
    memoryFormError.value = "";
    const content = memoryFactContent.value.trim();
    const category = memoryFactCategory.value.trim() || "context";
    const confidence = Number(memoryFactConfidence.value);
    if (!content) {
      memoryFormError.value = "记忆内容为必填项。";
      return;
    }
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      memoryFormError.value = "置信度必须在 0 到 1 之间。";
      return;
    }
    await memorySettings.createFact({ category, confidence, content });
    memoryFactContent.value = "";
    memoryFactCategory.value = "context";
    memoryFactConfidence.value = "0.8";
  }

  function startMemoryFactEdit(fact: MemoryFact) {
    memoryEditFactId.value = fact.id;
    memoryEditContent.value = fact.content;
    memoryEditCategory.value = fact.category;
    memoryEditConfidence.value = String(fact.confidence);
    memoryFormError.value = "";
  }

  function cancelMemoryFactEdit() {
    memoryEditFactId.value = null;
    memoryEditContent.value = "";
    memoryEditCategory.value = "";
    memoryEditConfidence.value = "0.8";
  }

  async function submitMemoryFactEdit() {
    memoryFormError.value = "";
    const factId = memoryEditFactId.value;
    const content = memoryEditContent.value.trim();
    const category = memoryEditCategory.value.trim() || "context";
    const confidence = Number(memoryEditConfidence.value);
    if (!factId) {
      memoryFormError.value = "请选择要编辑的记忆。";
      return;
    }
    if (!content) {
      memoryFormError.value = "记忆内容为必填项。";
      return;
    }
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      memoryFormError.value = "置信度必须在 0 到 1 之间。";
      return;
    }
    await memorySettings.updateFact({
      factId,
      input: { category, confidence, content },
    });
    cancelMemoryFactEdit();
  }

  async function deleteMemoryFactById(factId: string) {
    await memorySettings.deleteFact(factId);
    if (memoryEditFactId.value === factId) {
      cancelMemoryFactEdit();
    }
  }

  async function clearMemoryFacts() {
    memoryFormError.value = "";
    await memorySettings.clearAllMemory();
    cancelMemoryFactEdit();
    memoryExportText.value = "";
  }

  async function exportMemoryJson() {
    memoryFormError.value = "";
    const exportedMemory = await memorySettings.exportAllMemory();
    memoryExportText.value = JSON.stringify(exportedMemory, null, 2);
  }

  async function importMemoryJson() {
    memoryFormError.value = "";
    const parsedMemory = parseUserMemory(memoryImportText.value);
    if (!parsedMemory) {
      memoryFormError.value = "导入 JSON 必须符合记忆导出结构。";
      return;
    }
    const importedMemory = await memorySettings.importAllMemory(parsedMemory);
    memoryImportText.value = "";
    memoryExportText.value = JSON.stringify(importedMemory, null, 2);
  }

  function setMemoryEditCategory(value: string) {
    memoryEditCategory.value = value;
  }

  function setMemoryEditConfidence(value: string) {
    memoryEditConfidence.value = value;
  }

  function setMemoryEditContent(value: string) {
    memoryEditContent.value = value;
  }

  function setMemoryFactCategory(value: string) {
    memoryFactCategory.value = value;
  }

  function setMemoryFactConfidence(value: string) {
    memoryFactConfidence.value = value;
  }

  function setMemoryFactContent(value: string) {
    memoryFactContent.value = value;
  }

  function setMemoryImportText(value: string) {
    memoryImportText.value = value;
  }

  return {
    ...memorySettings,
    cancelMemoryFactEdit,
    clearMemoryFacts,
    deleteMemoryFactById,
    exportMemoryJson,
    importMemoryJson,
    memoryEditCategory,
    memoryEditConfidence,
    memoryEditContent,
    memoryEditFactId,
    memoryExportText,
    memoryFactCategory,
    memoryFactConfidence,
    memoryFactContent,
    memoryFormError,
    memoryImportText,
    memoryLoadErrorMessage,
    setMemoryEditCategory,
    setMemoryEditConfidence,
    setMemoryEditContent,
    setMemoryFactCategory,
    setMemoryFactConfidence,
    setMemoryFactContent,
    setMemoryImportText,
    startMemoryFactEdit,
    submitMemoryFact,
    submitMemoryFactEdit,
  };
}

export type SettingsMemoryController = ReturnType<typeof useSettingsMemory>;

function parseUserMemory(value: string): UserMemory | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  return isUserMemory(parsed) ? parsed : null;
}

function isUserMemory(value: unknown): value is UserMemory {
  if (!isRecord(value) || !isRecord(value.user) || !isRecord(value.history)) {
    return false;
  }
  return (
    typeof value.version === "string" &&
    typeof value.lastUpdated === "string" &&
    isMemorySection(value.user.workContext) &&
    isMemorySection(value.user.personalContext) &&
    isMemorySection(value.user.topOfMind) &&
    isMemorySection(value.history.recentMonths) &&
    isMemorySection(value.history.earlierContext) &&
    isMemorySection(value.history.longTermBackground) &&
    Array.isArray(value.facts) &&
    value.facts.every(isMemoryFact)
  );
}

function isMemorySection(value: unknown): value is { summary: string; updatedAt: string } {
  return (
    isRecord(value) &&
    typeof value.summary === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isMemoryFact(value: unknown): value is MemoryFact {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.content === "string" &&
    typeof value.category === "string" &&
    typeof value.confidence === "number" &&
    Number.isFinite(value.confidence) &&
    typeof value.createdAt === "string" &&
    typeof value.source === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
