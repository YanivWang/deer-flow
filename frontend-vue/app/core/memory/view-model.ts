/*
  【文件职责】     提供 Memory fact 表单、PATCH diff 与 search/filter 纯规则。
  【对应 frontend/】 components/workspace/settings/memory-settings-page.tsx
  【架构位置】     L3 framework-neutral Memory view model
  【主要导出】     validate/build fact input · filterMemory
  【依赖关系】     memory types
  【边界与注意】   confidence 是有限 0..1；PATCH 只发变更字段且显式 0 必须保留。
*/

import type {
  MemoryFact,
  MemoryFactInput,
  MemoryFactPatchInput,
  UserMemory,
} from "./types";

export type MemoryViewFilter = "all" | "facts" | "summaries";

export interface MemoryFactForm {
  content: string;
  category: string;
  confidence: string | number;
}

export type MemoryFactFormValidation =
  | { ok: true; value: MemoryFactInput }
  | { ok: false; field: "content" | "confidence" };

export function validateMemoryFactForm(
  form: MemoryFactForm,
): MemoryFactFormValidation {
  const content = form.content.trim();
  if (!content) return { ok: false, field: "content" };
  if (!String(form.confidence).trim()) {
    return { ok: false, field: "confidence" };
  }
  const confidence = Number(form.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return { ok: false, field: "confidence" };
  }
  return {
    ok: true,
    value: {
      content,
      category: form.category.trim() || "context",
      confidence,
    },
  };
}

export function buildMemoryFactCreateInput(form: MemoryFactForm) {
  const result = validateMemoryFactForm(form);
  if (!result.ok) throw new Error(result.field);
  return result.value;
}

export function buildMemoryFactPatchInput(
  fact: MemoryFact,
  form: MemoryFactForm,
): MemoryFactPatchInput {
  const next = buildMemoryFactCreateInput(form);
  const patch: MemoryFactPatchInput = {};
  if (next.content !== fact.content) patch.content = next.content;
  if (next.category !== fact.category) patch.category = next.category;
  if (next.confidence !== fact.confidence) patch.confidence = next.confidence;
  return patch;
}

export type MemorySummaryKey =
  | "workContext"
  | "personalContext"
  | "topOfMind"
  | "recentMonths"
  | "earlierContext"
  | "longTermBackground";

export interface MemorySummaryView {
  key: MemorySummaryKey;
  title: string;
  summary: string;
  updatedAt: string;
}

const DEFAULT_TITLES: Record<MemorySummaryKey, string> = {
  workContext: "Work context",
  personalContext: "Personal context",
  topOfMind: "Top of mind",
  recentMonths: "Recent months",
  earlierContext: "Earlier context",
  longTermBackground: "Long-term background",
};

function memorySummaries(
  memory: UserMemory,
  titles: Partial<Record<MemorySummaryKey, string>>,
): MemorySummaryView[] {
  const sections: Array<{
    key: MemorySummaryKey;
    summary: string;
    updatedAt: string;
  }> = [
    { key: "workContext", ...memory.user.workContext },
    { key: "personalContext", ...memory.user.personalContext },
    { key: "topOfMind", ...memory.user.topOfMind },
    { key: "recentMonths", ...memory.history.recentMonths },
    { key: "earlierContext", ...memory.history.earlierContext },
    { key: "longTermBackground", ...memory.history.longTermBackground },
  ];
  return sections.map((entry) => ({
    ...entry,
    title: titles[entry.key] ?? DEFAULT_TITLES[entry.key],
  }));
}

export function filterMemory(
  memory: UserMemory,
  query: string,
  filter: MemoryViewFilter,
  titles: Partial<Record<MemorySummaryKey, string>> = {},
) {
  const normalized = query.trim().toLocaleLowerCase();
  const allSummaries = memorySummaries(memory, titles);
  const populatedSummaries = allSummaries.filter((entry) =>
    entry.summary.trim(),
  );
  const memoryEmpty =
    populatedSummaries.length === 0 && memory.facts.length === 0;
  const summaries =
    filter === "facts"
      ? []
      : populatedSummaries.filter((entry) =>
          normalized
            ? `${entry.title} ${entry.summary}`
                .toLocaleLowerCase()
                .includes(normalized)
            : true,
        );
  const facts =
    filter === "summaries"
      ? []
      : memory.facts.filter((fact) =>
          normalized
            ? `${fact.content} ${fact.category}`
                .toLocaleLowerCase()
                .includes(normalized)
            : true,
        );
  return {
    summaries,
    facts,
    empty: memoryEmpty,
    noMatches:
      !memoryEmpty &&
      Boolean(normalized) &&
      summaries.length + facts.length === 0,
  };
}

export function truncateMemoryFact(content: string, maxLength = 140) {
  const normalized = content.replaceAll(/\s+/g, " ").trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}
