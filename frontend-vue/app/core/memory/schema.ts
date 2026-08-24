/*
  【文件职责】     解析并运行时校验 Memory export，明确 extra 与 duplicate import 合同。
  【架构位置】     L3 framework-neutral Memory contract
  【主要导出】     validateImportedMemory · parseMemoryImportText
  【依赖关系】     memory types
  【边界与注意】   完整结构跟随 React import 预检；extra 保留并警告，重复 ID 拒绝，重复内容保留并警告。
*/

import type { MemoryFact, UserMemory } from "./types";

export type MemoryImportIssueCode =
  | "malformed-json"
  | "root-type"
  | "missing-field"
  | "invalid-type"
  | "invalid-confidence"
  | "invalid-fact"
  | "duplicate-fact-id";

export type MemoryImportWarningCode = "extra-field" | "duplicate-fact-content";

export interface MemoryImportIssue {
  code: MemoryImportIssueCode;
  path: string;
}

export interface MemoryImportWarning {
  code: MemoryImportWarningCode;
  path: string;
}

export type MemoryImportValidation =
  | {
      ok: true;
      memory: UserMemory;
      warnings: MemoryImportWarning[];
    }
  | {
      ok: false;
      issues: MemoryImportIssue[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addExtraWarnings(
  value: Record<string, unknown>,
  known: ReadonlySet<string>,
  path: string,
  warnings: MemoryImportWarning[],
) {
  for (const key of Object.keys(value)) {
    if (!known.has(key)) {
      warnings.push({ code: "extra-field", path: `${path}.${key}` });
    }
  }
}

function requireRecord(
  value: unknown,
  path: string,
  issues: MemoryImportIssue[],
): value is Record<string, unknown> {
  if (isRecord(value)) return true;
  issues.push({ code: "invalid-type", path });
  return false;
}

function requireString(
  value: unknown,
  path: string,
  issues: MemoryImportIssue[],
) {
  if (typeof value === "string") return true;
  issues.push({ code: "invalid-type", path });
  return false;
}

function requireField(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: MemoryImportIssue[],
) {
  if (Object.hasOwn(value, key)) return true;
  issues.push({ code: "missing-field", path: `${path}.${key}` });
  return false;
}

const SECTION_KEYS = new Set(["summary", "updatedAt"]);

function validateSection(
  value: unknown,
  path: string,
  issues: MemoryImportIssue[],
  warnings: MemoryImportWarning[],
) {
  if (!requireRecord(value, path, issues)) return;
  for (const key of SECTION_KEYS) {
    if (requireField(value, key, path, issues)) {
      requireString(value[key], `${path}.${key}`, issues);
    }
  }
  addExtraWarnings(value, SECTION_KEYS, path, warnings);
}

const FACT_KEYS = new Set([
  "id",
  "content",
  "category",
  "categoryExtension",
  "topics",
  "confidence",
  "createdAt",
  "source",
  "sourceError",
  "schemaVersion",
  "status",
  "scope",
  "revision",
  "updatedAt",
  "consolidatedAt",
  "consolidatedFrom",
]);
const REQUIRED_FACT_STRING_KEYS = [
  "id",
  "content",
  "category",
  "createdAt",
  "source",
] as const;

function optionalString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: MemoryImportIssue[],
) {
  const field = value[key];
  if (field !== undefined && field !== null && typeof field !== "string") {
    issues.push({ code: "invalid-type", path: `${path}.${key}` });
  }
}

function optionalInteger(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: MemoryImportIssue[],
) {
  const field = value[key];
  if (
    field !== undefined &&
    field !== null &&
    (typeof field !== "number" || !Number.isInteger(field))
  ) {
    issues.push({ code: "invalid-type", path: `${path}.${key}` });
  }
}

function optionalStringArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: MemoryImportIssue[],
) {
  const field = value[key];
  if (
    field !== undefined &&
    field !== null &&
    (!Array.isArray(field) || field.some((item) => typeof item !== "string"))
  ) {
    issues.push({ code: "invalid-type", path: `${path}.${key}` });
  }
}

function validateFact(
  value: unknown,
  index: number,
  issues: MemoryImportIssue[],
  warnings: MemoryImportWarning[],
): value is MemoryFact {
  const path = `$.facts[${index}]`;
  if (!requireRecord(value, path, issues)) return false;
  for (const key of REQUIRED_FACT_STRING_KEYS) {
    if (requireField(value, key, path, issues)) {
      requireString(value[key], `${path}.${key}`, issues);
    }
  }
  if (
    typeof value.id === "string" &&
    (!value.id || !/^[A-Za-z0-9_-]+$/.test(value.id))
  ) {
    issues.push({ code: "invalid-fact", path: `${path}.id` });
  }
  if (typeof value.content === "string" && !value.content.trim()) {
    issues.push({ code: "invalid-fact", path: `${path}.content` });
  }
  if (requireField(value, "confidence", path, issues)) {
    const confidence = value.confidence;
    if (
      typeof confidence !== "number" ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1
    ) {
      issues.push({ code: "invalid-confidence", path: `${path}.confidence` });
    }
  }
  optionalString(value, "categoryExtension", path, issues);
  optionalString(value, "sourceError", path, issues);
  optionalString(value, "status", path, issues);
  optionalString(value, "updatedAt", path, issues);
  optionalString(value, "consolidatedAt", path, issues);
  optionalInteger(value, "schemaVersion", path, issues);
  optionalInteger(value, "revision", path, issues);
  optionalStringArray(value, "topics", path, issues);
  optionalStringArray(value, "consolidatedFrom", path, issues);
  if (
    value.status !== undefined &&
    value.status !== null &&
    value.status !== "active"
  ) {
    issues.push({ code: "invalid-fact", path: `${path}.status` });
  }
  if (
    value.revision !== undefined &&
    value.revision !== null &&
    typeof value.revision === "number" &&
    Number.isInteger(value.revision) &&
    value.revision < 1
  ) {
    issues.push({ code: "invalid-fact", path: `${path}.revision` });
  }
  if (value.scope !== undefined && value.scope !== null) {
    if (
      !isRecord(value.scope) ||
      Object.values(value.scope).some(
        (entry) => entry !== null && typeof entry !== "string",
      )
    ) {
      issues.push({ code: "invalid-type", path: `${path}.scope` });
    }
  }
  addExtraWarnings(value, FACT_KEYS, path, warnings);
  return true;
}

const ROOT_KEYS = new Set([
  "version",
  "revision",
  "lastUpdated",
  "user",
  "history",
  "facts",
]);
const USER_KEYS = new Set(["workContext", "personalContext", "topOfMind"]);
const HISTORY_KEYS = new Set([
  "recentMonths",
  "earlierContext",
  "longTermBackground",
]);

function normalizedFactContent(value: unknown) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
}

export function validateImportedMemory(value: unknown): MemoryImportValidation {
  if (!isRecord(value)) {
    return { ok: false, issues: [{ code: "root-type", path: "$" }] };
  }

  const issues: MemoryImportIssue[] = [];
  const warnings: MemoryImportWarning[] = [];
  for (const key of ["version", "lastUpdated", "user", "history", "facts"]) {
    requireField(value, key, "$", issues);
  }
  if (Object.hasOwn(value, "version")) {
    requireString(value.version, "$.version", issues);
  }
  if (Object.hasOwn(value, "lastUpdated")) {
    requireString(value.lastUpdated, "$.lastUpdated", issues);
  }
  optionalInteger(value, "revision", "$", issues);

  if (
    Object.hasOwn(value, "user") &&
    requireRecord(value.user, "$.user", issues)
  ) {
    for (const key of USER_KEYS) {
      if (requireField(value.user, key, "$.user", issues)) {
        validateSection(value.user[key], `$.user.${key}`, issues, warnings);
      }
    }
    addExtraWarnings(value.user, USER_KEYS, "$.user", warnings);
  }
  if (
    Object.hasOwn(value, "history") &&
    requireRecord(value.history, "$.history", issues)
  ) {
    for (const key of HISTORY_KEYS) {
      if (requireField(value.history, key, "$.history", issues)) {
        validateSection(
          value.history[key],
          `$.history.${key}`,
          issues,
          warnings,
        );
      }
    }
    addExtraWarnings(value.history, HISTORY_KEYS, "$.history", warnings);
  }

  if (Object.hasOwn(value, "facts")) {
    if (!Array.isArray(value.facts)) {
      issues.push({ code: "invalid-type", path: "$.facts" });
    } else {
      const ids = new Map<string, number>();
      const contents = new Map<string, number>();
      value.facts.forEach((fact, index) => {
        validateFact(fact, index, issues, warnings);
        if (!isRecord(fact)) return;
        if (typeof fact.id === "string") {
          const previous = ids.get(fact.id);
          if (previous !== undefined) {
            issues.push({
              code: "duplicate-fact-id",
              path: `$.facts[${index}].id`,
            });
          } else {
            ids.set(fact.id, index);
          }
        }
        const content = normalizedFactContent(fact.content);
        if (content) {
          const previous = contents.get(content);
          if (previous !== undefined) {
            warnings.push({
              code: "duplicate-fact-content",
              path: `$.facts[${index}].content`,
            });
          } else {
            contents.set(content, index);
          }
        }
      });
    }
  }
  addExtraWarnings(value, ROOT_KEYS, "$", warnings);

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, memory: value as UserMemory, warnings };
}

export function parseMemoryImportText(text: string): MemoryImportValidation {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, issues: [{ code: "malformed-json", path: "$" }] };
  }
  return validateImportedMemory(value);
}
