/*
  【文件职责】     以 Vue/TypeScript AST 扫描会进入产品 UI 的英文 SFC 字面量。
  【架构位置】     构建脚本共享库
  【主要导出】     productVueInventory · scanVueSource · scanProductVueFiles
  【依赖关系】     vue/compiler-sfc · TypeScript · app product SFCs
  【边界与注意】   动态 backend/user/code/file/URL 不含字面量；测试 fixture 不属于产品清单。
*/

import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compileTemplate, parse } from "vue/compiler-sfc";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PRODUCT_ROOTS = ["app/components", "app/pages", "app/layouts"];
const PRODUCT_ENTRY_FILES = ["app/app.vue"];
const TEST_FIXTURE_PREFIX = "app/pages/__m0/";
const ACCESSIBLE_ATTRIBUTES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "placeholder",
  "title",
]);
const UI_NAME =
  /(?:action|copy|empty|error|fallback|help|hint|label|message|notice|placeholder|statusLabel|subtitle|title|toast|tooltip|warning)s?$/i;
const UI_PROPERTY = new Set([
  "empty",
  "error",
  "hint",
  "label",
  "message",
  "placeholder",
  "subtitle",
  "toast",
  "tooltip",
  "warning",
]);
const SHORTCUT = /^[⌘⇧⌥⌃+\s]*[A-Z,./]$/;
const BRAND = /^(?:DeerFlow(?: Vue)?|DF)$/;
const TECHNICAL_ACRONYM =
  /^(?:API|CLI|CSS|EN|HTML|HTTP|IME|JSON|MCP|MIME|OIDC|PDF|SSE|UI|URL|WS)$/;
const DICTIONARY_KEY = /^[a-z][\w-]*(?:\.[\w-]+)+$/;

function hasEnglishCopy(value) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return (
    /[A-Za-z]{2,}/.test(normalized) &&
    !SHORTCUT.test(normalized) &&
    !BRAND.test(normalized) &&
    !TECHNICAL_ACRONYM.test(normalized) &&
    !DICTIONARY_KEY.test(normalized)
  );
}

function isInternalExpressionToken(value) {
  const normalized = value.trim();
  return (
    /^[a-z_][a-z0-9_./:-]*$/.test(normalized) ||
    normalized === "noopener,noreferrer" ||
    /^\{[A-Za-z_]\w*\}$/.test(normalized) ||
    /^[a-z]{2,3}-[A-Z]{2}$/.test(normalized)
  );
}

function lineOf(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function stringLiterals(expression) {
  const file = ts.createSourceFile(
    "expression.ts",
    `const __value = (${expression})`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const values = [];
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      values.push({ text: node.text, offset: node.getStart(file) });
    } else if (ts.isTemplateExpression(node)) {
      values.push({ text: node.head.text, offset: node.head.getStart(file) });
      for (const span of node.templateSpans) {
        values.push({
          text: span.literal.text,
          offset: span.literal.getStart(file),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return values.filter(
    ({ text }) => hasEnglishCopy(text) && !isInternalExpressionToken(text),
  );
}

function nameText(node) {
  if (!node) return "";
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text === "value"
      ? nameText(node.expression)
      : node.name.text;
  }
  return "";
}

function enclosingUiName(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isVariableDeclaration(current)) {
      return nameText(current.name);
    }
    if (ts.isFunctionDeclaration(current)) return nameText(current.name);
    if (ts.isPropertyAssignment(current)) return nameText(current.name);
    if (ts.isBinaryExpression(current)) return nameText(current.left);
  }
  return "";
}

function isUiScriptLiteral(node) {
  const parent = node.parent;
  if (
    ts.isBinaryExpression(parent) &&
    [
      ts.SyntaxKind.EqualsEqualsToken,
      ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken,
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ].includes(parent.operatorToken.kind)
  ) {
    return false;
  }
  if (
    ts.isPropertyAssignment(parent) &&
    UI_PROPERTY.has(nameText(parent.name))
  ) {
    return true;
  }
  const name = enclosingUiName(node);
  if (UI_NAME.test(name)) return true;
  for (let current = parent; current; current = current.parent) {
    if (
      ts.isNewExpression(current) &&
      nameText(current.expression) === "Error"
    ) {
      return true;
    }
    if (ts.isCallExpression(current)) {
      const callee = current.expression.getText();
      if (/(?:toast|notify|notification|showError|new Error)/i.test(callee)) {
        return true;
      }
      if (
        ts.isPropertyAccessExpression(current.expression) &&
        ["add", "push"].includes(current.expression.name.text) &&
        UI_NAME.test(nameText(current.expression.expression))
      ) {
        return true;
      }
    }
    if (ts.isStatement(current)) break;
  }
  return false;
}

function scanScript(source, content, startOffset, issues) {
  const file = ts.createSourceFile(
    "component.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const visit = (node) => {
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node)) &&
      isUiScriptLiteral(node)
    ) {
      const values = ts.isTemplateExpression(node)
        ? [
            node.head.text,
            ...node.templateSpans.map((span) => span.literal.text),
          ]
        : [node.text];
      for (const text of values.filter(
        (value) => hasEnglishCopy(value) && !isInternalExpressionToken(value),
      )) {
        issues.push({
          kind: "script-ui",
          text: text.replace(/\s+/g, " ").trim(),
          line: lineOf(source, startOffset + node.getStart(file)),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
}

function scanTemplate(source, content, startOffset, filename, issues) {
  const compiled = compileTemplate({
    source: content,
    filename,
    id: "i18n-source-guard",
  });
  if (compiled.errors.length) {
    throw new Error(
      `${filename}: template parse failed: ${compiled.errors[0]}`,
    );
  }
  const visit = (node) => {
    if (node.type === 2 && hasEnglishCopy(node.content)) {
      issues.push({
        kind: "template-text",
        text: node.content.replace(/\s+/g, " ").trim(),
        line: lineOf(source, startOffset + node.loc.start.offset),
      });
    }
    for (const property of node.props ?? []) {
      if (
        property.type === 6 &&
        ACCESSIBLE_ATTRIBUTES.has(property.name) &&
        property.value &&
        hasEnglishCopy(property.value.content)
      ) {
        issues.push({
          kind: "template-attribute",
          text: property.value.content.trim(),
          line: lineOf(source, startOffset + property.loc.start.offset),
        });
      }
      if (
        property.type === 7 &&
        property.name === "bind" &&
        property.arg?.type === 4 &&
        ACCESSIBLE_ATTRIBUTES.has(property.arg.content) &&
        property.exp
      ) {
        const expression =
          property.exp.loc.source ||
          (property.exp.type === 4 ? property.exp.content : "");
        for (const literal of stringLiterals(expression)) {
          issues.push({
            kind: "template-bound-attribute",
            text: literal.text.replace(/\s+/g, " ").trim(),
            line: lineOf(source, startOffset + property.loc.start.offset),
          });
        }
      }
    }
    if (node.type === 5 && node.content) {
      const expression =
        node.content.loc.source ||
        (node.content.type === 4 ? node.content.content : "");
      for (const literal of stringLiterals(expression)) {
        issues.push({
          kind: "template-expression",
          text: literal.text.replace(/\s+/g, " ").trim(),
          line: lineOf(source, startOffset + node.loc.start.offset),
        });
      }
    }
    for (const child of node.children ?? []) visit(child);
    for (const branch of node.branches ?? []) visit(branch);
  };
  visit(compiled.ast);
}

export function scanVueSource(source, filename) {
  const { descriptor, errors } = parse(source, { filename });
  if (errors.length)
    throw new Error(`${filename}: SFC parse failed: ${errors[0]}`);
  const issues = [];
  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (!block) continue;
    scanScript(source, block.content, block.loc.start.offset, issues);
  }
  if (descriptor.template) {
    scanTemplate(
      source,
      descriptor.template.content,
      descriptor.template.loc.start.offset,
      filename,
      issues,
    );
  }
  return issues.map((issue) => ({ filename, ...issue }));
}

function vueFiles(relRoot) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(join(ROOT, directory), {
      withFileTypes: true,
    })) {
      const next = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (extname(entry.name) === ".vue") files.push(next);
    }
  };
  walk(relRoot);
  return files;
}

export function productVueInventory() {
  const discovered = [
    ...PRODUCT_ENTRY_FILES,
    ...PRODUCT_ROOTS.flatMap(vueFiles),
  ].sort();
  return {
    checked: discovered.filter((file) => !file.startsWith(TEST_FIXTURE_PREFIX)),
    excludedTestFixtures: discovered.filter((file) =>
      file.startsWith(TEST_FIXTURE_PREFIX),
    ),
  };
}

export function scanProductVueFiles() {
  return productVueInventory().checked.flatMap((file) =>
    scanVueSource(readFileSync(join(ROOT, file), "utf8"), file),
  );
}

export function relativeGuardPath(path) {
  return relative(ROOT, path);
}
