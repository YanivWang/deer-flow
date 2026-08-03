import { LABELLED_DOTTED_ARROW_RE } from "./constants";

export function normalizeMermaidCode(code: string): string {
  return code.split("\n").map((line) => line.replace(
    LABELLED_DOTTED_ARROW_RE,
    (_match, indent: string, source: string, label: string, target: string) => `${indent}${source} -. ${label} .-> ${target}`,
  )).join("\n");
}
