/*
  【文件职责】     守住 05 的每一条不变式在 06 的归属表里**恰好**被认领一次。
  【对应 frontend/】 无（本仓自写的护栏）
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     frontend-vue-build-docs/05-invariants.md · 06-migration-plan.md
  【边界与注意】   这条门禁和 `forbidden-deps.test.ts` 是同一类东西：**被现实逼出来的，
                   不是预防性洁癖。**

                   06 早期版本用 05 的**组名**做验收单位（「A 组全部」「B、C、E、F、G、J 组」）。
                   05 的组是从一个**没有分层的 React 应用**里按话题聚类的，而里程碑是按层切的，
                   两套切法不同构——A、C、F、H、J、K 六个组都横跨里程碑。后果实测有三个：

                     - M2 被要求交付 A7/A8，而它们依赖 M4a 才引入的 vue-query；
                     - C 组同时被 §M2（经 A 组）、§M4a、§M4b 三处认领；
                     - J 组（认证与存储）挂在「通用 agent UI」下，而它在 M0 就验完了。

                   还有反方向的漏网：H、M、N **三个整组**不在任何验收清单里。
                   也就是说「组名引用」既会重复认领、也会静默漏项，而两种错法都**读不出来**——
                   要把 14 个组、115 条逐个对一遍才发现。人不会去做这件事，所以让机器做。

                   本文件只管**归属的完备性与唯一性**，不管归属得对不对。
                   「A7 该不该在 M4a」是人的判断，写在 06 的归属表「依据」列里；
                   「A7 有没有人认领、是不是被两个里程碑同时认领」是机器的事。

                   ⚠️ **一处已知的、有意不做的覆盖**：本文件只解析**归属表**，
                   不解析各里程碑那段散文式的「验收清单」。所以「清单里多写了一条
                   归属表没给它的条目」抓不到（故障注入实测：把 `C1–C9` 塞进 M4b
                   的清单，本文件仍然全绿）。

                   不做的理由是**做了会变成一个会被放宽的门禁**：条目 id `M1`–`M6`
                   与里程碑名 `M0`–`M8` 在文本里完全同形。M1 的验收清单里就有一句
                   「验收在 M4a」——按 id 规则解析，那是不变式 M4（逐词动画 key），
                   而它其实是里程碑名。要消歧就得给散文加标记语法，等于为了门禁
                   重新设计文档格式；判据一旦有误报，第一次红之后就会被人放宽，
                   门禁随即作废（06 §M3 gate 的「字符级判据一定会红然后被人为放宽」
                   说的是同一件事）。

                   兜底靠最后一条用例：**每个「验收清单」都必须引用归属表**。
                   它挡不住内容漂移，但保证了写清单的人被指回唯一来源。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const docs = new URL("../../../frontend-vue-build-docs/", import.meta.url);
const invariants = readFileSync(
  fileURLToPath(new URL("05-invariants.md", docs)),
  "utf8",
);
const plan = readFileSync(
  fileURLToPath(new URL("06-migration-plan.md", docs)),
  "utf8",
);

/** 05 的条目行长这样：`| A1  | …` 或 `| **L9**  | …`（加粗的是后补的条目）。 */
function declaredInvariants(): string[] {
  const found: string[] = [];
  for (const line of invariants.split("\n")) {
    if (!line.startsWith("|")) continue;
    const first = (line.split("|")[1] ?? "").replaceAll("*", "").trim();
    if (/^[A-N]\d+$/.test(first)) found.push(first);
  }
  return found;
}

/** 06 归属表的第一列，展开 `L1–L16` 这类区间。 */
function claimedByPlan(): string[] {
  const section = plan.split("## 验收项归属：05 全表 × 里程碑")[1] ?? "";
  const table = section.split("\n---\n")[0] ?? "";
  const claimed: string[] = [];

  for (const line of table.split("\n")) {
    if (!line.startsWith("|") || line.startsWith("| ---")) continue;
    let cell = (line.split("|")[1] ?? "").replaceAll("*", "").trim();
    if (!cell || cell === "条目") continue;

    // 先吃掉区间，再吃剩下的单点，否则 `L1–L16` 会被当成 L1 和 L16 两个单点。
    for (const range of [
      ...cell.matchAll(/([A-N])(\d+)\s*[–-]\s*[A-N]?(\d+)/g),
    ]) {
      const [, group, from, to] = range;
      for (let i = Number(from); i <= Number(to); i += 1) {
        claimed.push(`${group}${i}`);
      }
      cell = cell.replace(range[0], " ");
    }
    for (const single of cell.matchAll(/\b([A-N]\d+)\b/g)) {
      claimed.push(single[1] as string);
    }
  }
  return claimed;
}

describe("05 的不变式与 06 的验收归属", () => {
  const declared = declaredInvariants();
  const claimed = claimedByPlan();

  it("两份文档都读到了（解析失败时不能假绿）", () => {
    // 05 现有 A–N 共 14 组。解析器一旦被文档格式变化打挂，
    // 下面几条会退化成「空集等于空集」——先钉住规模。
    expect(declared.length).toBeGreaterThanOrEqual(110);
    expect(claimed.length).toBeGreaterThanOrEqual(110);
    expect(new Set(declared.map((id) => id[0])).size).toBe(14);
  });

  it("每一条都被恰好一个里程碑认领（不漏项）", () => {
    const owned = new Set(claimed);
    expect(declared.filter((id) => !owned.has(id))).toEqual([]);
  });

  it("没有一条被两个里程碑同时认领（不重复）", () => {
    const seen = new Map<string, number>();
    for (const id of claimed) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect(
      [...seen].filter(([, count]) => count > 1).map(([id]) => id),
    ).toEqual([]);
  });

  it("归属表里没有 05 根本不存在的条目", () => {
    const real = new Set(declared);
    expect([...new Set(claimed)].filter((id) => !real.has(id))).toEqual([]);
  });

  it("各里程碑的验收清单只引用归属表，不再用组名做单位", () => {
    // 「A 组全部」「B、C、E、F、G、J 组」正是造成三处重复认领的写法。
    const offenders: string[] = [];
    for (const line of plan.split("\n")) {
      if (!line.includes("**验收清单**")) continue;
      if (!line.includes("归属表")) offenders.push(line.trim().slice(0, 80));
    }
    expect(offenders).toEqual([]);
  });
});
