import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = resolve(process.cwd());
const forbiddenPackages = /^(?:react|react-dom|next|ai|@langchain(?:\/|$)|@langgraph(?:\/|$)|motion-v$|@vue-flow\/core$|canvas-confetti$|nanoid$|tokenlens$|@uiw\/codemirror-theme-)/;
const forbiddenImports = /(?:from\s*["']|import\s*\(\s*["'])((?:react|react-dom|next|ai|@langchain(?:\/|$)|@langgraph(?:\/|$)|motion-v|@vue-flow\/core|canvas-confetti|nanoid|tokenlens|@uiw\/codemirror-theme-)[^"']*)["']/;

describe("Vue dependency boundary guard", () => {
  it("does not declare React, Next, AI, or LangGraph runtime packages", () => {
    const packageJson = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8")) as Record<string, Record<string, string>>;
    const dependencies = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.optionalDependencies,
    });

    expect(dependencies.filter((dependency) => forbiddenPackages.test(dependency))).toEqual([]);
  });

  it("does not import forbidden framework or SDK modules from Vue source", () => {
    const findings = filesUnder(projectRoot)
      .filter((file) => /\.(?:ts|vue|mjs)$/.test(file))
      .filter((file) => !file.includes("/node_modules/") && !file.includes("/.nuxt/"))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        const match = source.match(forbiddenImports);
        return match ? [`${file}: ${match[1]}`] : [];
      });

    expect(findings).toEqual([]);
  });
});

function filesUnder(directory: string): string[] {
  if (new Set(["node_modules", ".nuxt", ".output", "playwright-report", "test-results"]).has(directory.split("/").at(-1) ?? "")) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}
