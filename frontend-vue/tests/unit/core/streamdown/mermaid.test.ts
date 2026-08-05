/*
  由 scripts/rstest-to-vitest.mjs 从 frontend/tests/unit/core/streamdown/mermaid.test.ts 机械生成。
  基线 27a425b0 · 改动仅限 @rstest/core → vitest、rs.* → vi.*。
  勿手改：make codemod-check 会红。需要为 Vue 侧适配就登记进 HAND_MAINTAINED。
*/

import { expect, test } from "vitest";

import { normalizeMermaidMarkdown } from "@/core/streamdown/mermaid";
import { preprocessStreamdownMarkdown } from "@/core/streamdown/preprocess";

test("normalizes labelled dotted arrows inside mermaid fences", () => {
  const markdown = [
    "```mermaid",
    "flowchart TD",
    '    A -- "sealed memory" -.-> F',
    '    B -- "resonance" -.-> A',
    "```",
  ].join("\n");

  expect(normalizeMermaidMarkdown(markdown)).toBe(
    [
      "```mermaid",
      "flowchart TD",
      '    A -. "sealed memory" .-> F',
      '    B -. "resonance" .-> A',
      "```",
    ].join("\n"),
  );
});

test("does not rewrite non-mermaid code fences", () => {
  const markdown = ["```text", 'A -- "sealed memory" -.-> F', "```"].join("\n");

  expect(normalizeMermaidMarkdown(markdown)).toBe(markdown);
});

test("preserves mermaid fence metadata", () => {
  const markdown = [
    '```mermaid title="relationships"',
    'A -- "sealed memory" -.-> F',
    "```",
  ].join("\n");

  expect(normalizeMermaidMarkdown(markdown)).toBe(
    [
      '```mermaid title="relationships"',
      'A -. "sealed memory" .-> F',
      "```",
    ].join("\n"),
  );
});

test("normalizes labelled dotted arrows with inconsistent spacing", () => {
  const markdown = [
    "```mermaid",
    'A--"sealed memory"-.->F',
    'B --"resonance"-.-> A',
    'C-- "handoff" -.->D',
    "```",
  ].join("\n");

  expect(normalizeMermaidMarkdown(markdown)).toBe(
    [
      "```mermaid",
      'A -. "sealed memory" .-> F',
      'B -. "resonance" .-> A',
      'C -. "handoff" .-> D',
      "```",
    ].join("\n"),
  );
});

test("normalizes mermaid fences with CRLF line endings", () => {
  const markdown = ["```mermaid", 'A--"sealed memory"-.->F', "```"].join(
    "\r\n",
  );

  expect(normalizeMermaidMarkdown(markdown)).toBe(
    ["```mermaid", 'A -. "sealed memory" .-> F', "```"].join("\n"),
  );
});

test("preserves empty mermaid fences", () => {
  const markdown = ["```mermaid", "```"].join("\n");

  expect(normalizeMermaidMarkdown(markdown)).toBe(markdown);
});

test("normalizes labelled dotted arrows inside tilde mermaid fences", () => {
  const markdown = ["~~~mermaid", 'A -- "sealed memory" -.-> F', "~~~"].join(
    "\n",
  );

  expect(normalizeMermaidMarkdown(markdown)).toBe(
    ["~~~mermaid", 'A -. "sealed memory" .-> F', "~~~"].join("\n"),
  );
});

test("normalizes mermaid fences with longer backtick closing fences", () => {
  const markdown = ["```mermaid", 'A -- "sealed memory" -.-> F', "````"].join(
    "\n",
  );

  expect(normalizeMermaidMarkdown(markdown)).toBe(
    ["```mermaid", 'A -. "sealed memory" .-> F', "````"].join("\n"),
  );
});

test("normalizes mermaid fences with longer tilde closing fences", () => {
  const markdown = ["~~~mermaid", 'A -- "sealed memory" -.-> F', "~~~~"].join(
    "\n",
  );

  expect(normalizeMermaidMarkdown(markdown)).toBe(
    ["~~~mermaid", 'A -. "sealed memory" .-> F', "~~~~"].join("\n"),
  );
});

test("preprocesses markdown only when mermaid normalization can apply", () => {
  const textOnlyMarkdown = 'A -- "sealed memory" -.-> F';
  const plainMermaidMarkdown = ["```mermaid", "A --> F", "```"].join("\n");
  const labelledMermaidMarkdown = [
    "```mermaid",
    'A -- "sealed memory" -.-> F',
    "```",
  ].join("\n");

  expect(preprocessStreamdownMarkdown(textOnlyMarkdown)).toBe(textOnlyMarkdown);
  expect(preprocessStreamdownMarkdown(plainMermaidMarkdown)).toBe(
    plainMermaidMarkdown,
  );
  expect(preprocessStreamdownMarkdown(labelledMermaidMarkdown)).toBe(
    ["```mermaid", 'A -. "sealed memory" .-> F', "```"].join("\n"),
  );
});
