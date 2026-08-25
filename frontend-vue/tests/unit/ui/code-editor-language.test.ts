/*
  【文件职责】     固定代码编辑器的语言归一表：哪些名字进哪个语法模式，哪些落到纯文本。
  【架构位置】     测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/core/code-editor/language.ts · app/core/artifacts/policy.ts
  【边界与注意】   这张表是**产品行为**，不是实现细节：它决定用户打开一个文件时看不看得到
                   高亮。所以逐条钉住，并且和 artifact 策略表交叉验证——归一到一个
                   加载不出来的模式，或者策略表产出一个归一函数不认识的名字，
                   都只会表现为「这个文件突然没有高亮了」，没有任何报错。
*/

import { describe, expect, it } from "vitest";

import {
  normalizeCodeEditorLanguage,
  type CodeEditorLanguage,
} from "@/core/code-editor/language";
import { classifyArtifact } from "@/core/artifacts/policy";

describe("code editor language normalization", () => {
  it.each([
    ["css", "css"],
    ["scss", "css"],
    ["sass", "css"],
    ["less", "css"],
    ["html", "html"],
    ["xml", "html"],
    ["javascript", "javascript"],
    ["typescript", "javascript"],
    ["jsx", "javascript"],
    ["tsx", "javascript"],
    ["json", "json"],
    ["jsonc", "json"],
    ["json5", "json"],
    ["markdown", "markdown"],
    ["mdx", "markdown"],
    ["python", "python"],
    ["py", "python"],
  ])("maps %s to the %s mode", (input, expected) => {
    expect(normalizeCodeEditorLanguage(input)).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(normalizeCodeEditorLanguage("Python")).toBe("python");
    expect(normalizeCodeEditorLanguage("TypeScript")).toBe("javascript");
  });

  it.each([
    ["bash", "text"],
    ["go", "text"],
    ["rust", "text"],
    ["yaml", "text"],
    ["vue", "text"],
    ["", "text"],
  ])("falls back to plain text for %s", (input, expected) => {
    expect(normalizeCodeEditorLanguage(input)).toBe(expected);
  });

  it("treats a missing language as plain text instead of throwing", () => {
    expect(normalizeCodeEditorLanguage(null)).toBe("text");
    expect(normalizeCodeEditorLanguage(undefined)).toBe("text");
  });

  it("accepts every language the artifact policy can produce", () => {
    const modes: CodeEditorLanguage[] = [
      "css",
      "html",
      "javascript",
      "json",
      "markdown",
      "python",
      "text",
    ];
    const extensions = [
      "css",
      "html",
      "js",
      "json",
      "md",
      "py",
      "ts",
      "tsx",
      "jsx",
      "scss",
      "xml",
      "yaml",
      "toml",
      "sh",
      "go",
      "rs",
      "vue",
      "txt",
    ];
    for (const extension of extensions) {
      const policy = classifyArtifact(`/mnt/user-data/outputs/a.${extension}`);
      expect(policy.kind).toBe("text");
      expect(modes).toContain(
        normalizeCodeEditorLanguage(
          policy.kind === "text" ? policy.language : null,
        ),
      );
    }
  });
});
