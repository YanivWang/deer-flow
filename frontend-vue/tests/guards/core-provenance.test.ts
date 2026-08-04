/*
  【文件职责】     守护 app/core 溯源台账：文件必须登记，COPIED 档必须与 baseline hash 逐字节一致。
  【对应 frontend/】 无；M1 新增护城河
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     app/core/PROVENANCE.md、baseline/core-sha256.json
  【边界与注意】   只读签入文件，**不调用 git**——06 §1e 要求普通 CI 不依赖历史对象是否存在。
                   台账的重建由 `make baseline-refresh` 单独承担。
                   不要靠改 baseline 让这个测试变绿：改了文件就降级分类。
*/

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { extname } from "node:path";
import { describe, expect, it } from "vitest";

const coreRoot = new URL("../../app/core/", import.meta.url);
const ledgerUrl = new URL("PROVENANCE.md", coreRoot);
const baselineUrl = new URL("../../baseline/core-sha256.json", import.meta.url);

const CLASSES = ["COPIED", "RETYPED", "ADAPTED", "ADDED"] as const;
type Provenance = (typeof CLASSES)[number];

interface LedgerRow {
  file: string;
  class: Provenance;
  source: string | null;
  note: string;
}

/** 台账正文只有一张表；解析出 4 列并跳过表头与分隔行。 */
function parseLedger(markdown: string): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const cells = trimmed
      .slice(1, trimmed.endsWith("|") ? -1 : undefined)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length < 4) continue;

    const file = cells[0]?.replace(/^`|`$/g, "") ?? "";
    const klass = cells[1]?.replace(/^`|`$/g, "") ?? "";
    if (!CLASSES.includes(klass as Provenance)) continue; // 表头、说明表、分隔行
    if (!file || file.includes(" ")) continue;

    const rawSource = cells[2]?.replace(/^`|`$/g, "") ?? "";
    rows.push({
      file,
      class: klass as Provenance,
      source: rawSource === "—" || rawSource === "" ? null : rawSource,
      note: cells[3] ?? "",
    });
  }
  return rows;
}

function sourceFiles(directory: URL, prefix = ""): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return sourceFiles(
        new URL(`${entry.name}/`, directory),
        `${prefix}${entry.name}/`,
      );
    }
    const ext = extname(entry.name);
    return ext === ".ts" || ext === ".tsx" ? [`${prefix}${entry.name}`] : [];
  });
}

const ledger = parseLedger(readFileSync(ledgerUrl, "utf8"));
const onDisk = sourceFiles(coreRoot).sort();
const baseline = JSON.parse(readFileSync(baselineUrl, "utf8")) as {
  sourceRoot: string;
  files: Record<string, string>;
};

describe("app/core 溯源台账", () => {
  it("磁盘上的每个文件都已登记", () => {
    const registered = new Set(ledger.map((row) => row.file));
    const unregistered = onDisk.filter((file) => !registered.has(file));
    expect(unregistered).toEqual([]);
  });

  it("台账里的每一行都指向真实存在的文件", () => {
    const present = new Set(onDisk);
    const stale = ledger
      .map((row) => row.file)
      .filter((file) => !present.has(file));
    expect(stale).toEqual([]);
  });

  it("同一个文件不重复登记", () => {
    const seen = new Set<string>();
    const duplicated = ledger
      .map((row) => row.file)
      .filter((file) => (seen.has(file) ? true : (seen.add(file), false)));
    expect(duplicated).toEqual([]);
  });

  it("COPIED / RETYPED / ADAPTED 必须写明上游来源", () => {
    const missing = ledger
      .filter((row) => row.class !== "ADDED" && !row.source)
      .map((row) => row.file);
    expect(missing).toEqual([]);
  });

  it("COPIED 档与 baseline hash 逐字节一致", () => {
    const drifted: string[] = [];
    for (const row of ledger) {
      if (row.class !== "COPIED" || !row.source) continue;

      const expected = baseline.files[row.source];
      if (!expected) {
        drifted.push(`${row.file}: baseline 中没有来源 ${row.source}`);
        continue;
      }
      const actual = createHash("sha256")
        .update(readFileSync(new URL(row.file, coreRoot)))
        .digest("hex");
      if (actual !== expected) {
        drifted.push(
          `${row.file}: 与 ${baseline.sourceRoot}/${row.source} 不一致` +
            `（期望 ${expected.slice(0, 12)}…，实际 ${actual.slice(0, 12)}…）。` +
            "改过就降级成 RETYPED/ADAPTED 并写明理由，不要改 baseline。",
        );
      }
    }
    expect(drifted).toEqual([]);
  });
});
