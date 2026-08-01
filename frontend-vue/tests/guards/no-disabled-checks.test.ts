import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "..");
const scannedRoots = ["frontend-vue", "docker-vue"];
const skippedFiles = new Set(["frontend-vue/tests/guards/no-disabled-checks.test.ts"]);
const skippedDirectories = new Set([".nuxt", ".output", "node_modules", "playwright-report", "test-results"]);
const skippedSuffixes = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".lock"];

const prohibitedPatterns = [
  { label: "explicit any", pattern: /\bany\b|as\s+any\b/ },
  { label: "ts ignore", pattern: new RegExp(`@ts-${"ignore"}`) },
  { label: "ts expect error", pattern: new RegExp(`@ts-${"expect-error"}`) },
  { label: "eslint disable", pattern: new RegExp(`eslint-${"disable"}`) },
  { label: "stylelint disable", pattern: new RegExp(`stylelint-${"disable"}`) },
  { label: "test skip or only", pattern: /\b(?:describe|it|test)\.(?:skip|only)\s*\(/ },
] as const;

describe("disabled checks guard", () => {
  it("keeps Vue code and tests free of broad bypass patterns", () => {
    const findings = scanFiles().flatMap((file) => {
      const text = readFileSync(resolve(repoRoot, file), "utf8");
      return prohibitedPatterns
        .filter(({ pattern }) => pattern.test(text))
        .map(({ label }) => `${file}: ${label}`);
    });

    expect(findings).toEqual([]);
  });

  it("covers root runtime config, scripts, and Docker Vue files", () => {
    expect(scanFiles()).toEqual(
      expect.arrayContaining([
        "frontend-vue/Dockerfile",
        "frontend-vue/nuxt.config.ts",
        "frontend-vue/playwright.vue.config.ts",
        "frontend-vue/scripts/e2e-nuxt-dev-server.mjs",
        "docker-vue/docker-compose.yaml",
      ]),
    );
  });
});

function scanFiles(): string[] {
  return scannedRoots.flatMap((root) => walk(resolve(repoRoot, root)));
}

function walk(path: string): string[] {
  const stats = statSync(path);
  if (stats.isDirectory()) {
    if (skippedDirectories.has(basename(path))) {
      return [];
    }
    return readdirSync(path).flatMap((entry) => walk(resolve(path, entry)));
  }

  const relativePath = relative(repoRoot, path);
  if (skippedFiles.has(relativePath) || skippedSuffixes.some((suffix) => relativePath.endsWith(suffix))) {
    return [];
  }
  return [relativePath];
}
