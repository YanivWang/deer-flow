/*
  【文件职责】     守护 agent-core 的框架和 DeerFlow UI 禁入边界。
  【对应 frontend/】 无；M0 新增架构门禁
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     扫描 packages/agent-core/src
  【边界与注意】   禁止通过改测试放宽 L1 边界。
*/

import { readdirSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = new URL("../packages/agent-core/src/", import.meta.url);
const forbidden = [
  /^vue(?:\/|$)/,
  /^nuxt(?:\/|$)/,
  /^#(?:app|imports)/,
  /^pinia(?:\/|$)/,
  /^react(?:\/|$)/,
  /^@langchain\/langgraph-sdk(?:\/|$)/,
  /^@\/components(?:\/|$)/,
  /^@\/core\/agent-deerflow(?:\/|$)/,
];

function sourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(
      `${entry.name}${entry.isDirectory() ? "/" : ""}`,
      directory,
    );
    return entry.isDirectory()
      ? sourceFiles(child)
      : extname(entry.name) === ".ts"
        ? [child]
        : [];
  });
}

describe("agent-core architecture", () => {
  it("contains no host-framework or DeerFlow UI imports", () => {
    const violations: string[] = [];
    for (const file of sourceFiles(sourceRoot)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /(?:from\s+|import\s*)["']([^"']+)["']/g,
      )) {
        const specifier = match[1] ?? "";
        if (forbidden.some((pattern) => pattern.test(specifier))) {
          violations.push(`${file.pathname}: ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
