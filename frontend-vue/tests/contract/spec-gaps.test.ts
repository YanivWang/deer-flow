import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import specGaps from "../SPEC-GAPS.md?raw";

const frontendVueRoot = process.cwd();
const repoRoot = resolve(frontendVueRoot, "..");

describe("SPEC-GAPS handoff map", () => {
  it("keeps referenced Vue test/script/docker-vue paths resolvable", () => {
    const missing = referencedPaths(specGaps).filter((path) => !pathExists(path));

    expect(missing).toEqual([]);
  });

  it("keeps Closed/Anchored area names unique", () => {
    const areas = closedAreaNames(specGaps);
    const duplicateAreas = areas.filter((area, index) => areas.indexOf(area) !== index);

    expect(duplicateAreas).toEqual([]);
  });

  it("keeps Open Gaps scoped, unique, exit-gated, and separate from Closed/Anchored areas", () => {
    const closedAreas = new Set(closedAreaNames(specGaps));
    const openRows = openGapRows(specGaps);
    const openAreas = openRows.map((row) => row.area);
    const duplicateOpenAreas = openAreas.filter((area, index) => openAreas.indexOf(area) !== index);
    const reopenedClosedAreas = openAreas.filter((area) => closedAreas.has(area));
    const rowsWithInvalidScope = openRows
      .filter((row) => !isOpenGapScope(row.scope))
      .map((row) => row.area);
    const missingExitRows = openRows
      .filter((row) => row.requiredExit.length === 0)
      .map((row) => row.area);

    expect(duplicateOpenAreas).toEqual([]);
    expect(reopenedClosedAreas).toEqual([]);
    expect(rowsWithInvalidScope).toEqual([]);
    expect(missingExitRows).toEqual([]);
  });
});

function referencedPaths(markdown: string): string[] {
  const paths = new Set<string>();
  const backtickPattern = /`([^`]+)`/g;
  let match: RegExpExecArray | null;
  while ((match = backtickPattern.exec(markdown)) !== null) {
    const token = match[1] ?? "";
    for (const part of token.split(",")) {
      const path = part.trim();
      if (isTrackedReference(path)) {
        paths.add(path);
      }
    }
  }
  return [...paths].sort();
}

function isTrackedReference(path: string): boolean {
  return (
    path.startsWith("tests/") ||
    path.startsWith("scripts/") ||
    path.startsWith("docker-vue/") ||
    path === "playwright.vue.config.ts"
  );
}

function pathExists(path: string): boolean {
  const base = path.startsWith("docker-vue/") ? repoRoot : frontendVueRoot;
  const normalizedPath = path.endsWith("/*") ? path.slice(0, -2) : path;
  return existsSync(resolve(base, normalizedPath));
}

function closedAreaNames(markdown: string): string[] {
  const closedSection = markdown.split("## Open Gaps")[0] ?? "";
  return closedSection
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| Area") && !line.startsWith("| ---"))
    .map((line) => line.split("|")[1]?.trim() ?? "")
    .filter(Boolean);
}

function openGapRows(markdown: string): Array<{ area: string; requiredExit: string; scope: string }> {
  const openSection = markdown.split("## Open Gaps")[1]?.split("## Notes")[0] ?? "";
  return openSection
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| Area") && !line.startsWith("| ---"))
    .map((line) => {
      const cells = line.split("|").map((cell) => cell.trim());
      return {
        area: cells[1] ?? "",
        scope: cells[2] ?? "",
        requiredExit: cells[4] ?? "",
      };
    })
    .filter((row) => row.area.length > 0);
}

function isOpenGapScope(scope: string): boolean {
  return (
    scope === "Release must" ||
    scope === "P2 candidate" ||
    scope === "Live-only" ||
    scope === "Downgrade candidate"
  );
}
