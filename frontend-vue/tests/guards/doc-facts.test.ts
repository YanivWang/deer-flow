/*
  【文件职责】     守住文档里那些**可核实的数字**与代码实际情况一致。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     I18N_INVENTORY.md · BEHAVIOR_CONTRACTS.md · PARITY_GAPS.md ·
                   baseline/*.json · tests/fixtures/streams/*.sse · i18n source guard
  【边界与注意】   与 `doc-references.test.ts` 分工：那边管「文档点名的东西存在吗」，
                   这边管「文档说的数字对吗」。两类都是同一种失效——文档在说谎，
                   而读它的人（越来越多是模型）没有第二个信息源可以对照。

                   一次盘点实测出来的偏差：
                   - `I18N_INVENTORY.md` 说 82 个 SFC / 80 个产品 SFC，实际 158 / 156；
                   - 同一份文档说 976 个 key / 160 个 unused，实际 987 / 150；
                   - `BEHAVIOR_CONTRACTS.md` 开头写「A–Q 共 17 组」，实际已经是 A–S 19 组；
                   - `PARITY_GAPS.md` 顶部写「未完成清单」，而 58 个 ID 全部 DONE；
                   - `openapi.snapshot.README.md` 说其余 24 个 router 无条件挂载，实际 22。
                   没有一条会让任何门禁变红，因为在此之前没有门禁读过文档。

                   只钉**能从签入产物直接算出来**的数字。测试条数、lint warning 条数
                   这类每次改动都会变的量，正确做法是不写进散文，而不是在这里追着它跑。
*/

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { productVueInventory } from "../../scripts/lib/i18n-source-guard.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("文档里的数字和代码一致", () => {
  it("I18N_INVENTORY 的 SFC 数就是 inventory 实际扫到的数", () => {
    const inventory = productVueInventory() as {
      checked: string[];
      excludedTestFixtures: string[];
    };
    const total =
      inventory.checked.length + inventory.excludedTestFixtures.length;
    const doc = read("I18N_INVENTORY.md");
    expect(doc).toContain(`当前 checkout 共有 ${total} 个 Vue SFC`);
    expect(doc).toContain(`${inventory.checked.length} 个产品 SFC 全部进入`);
    expect(doc).toContain(
      `${inventory.checked.length} 个产品 SFC 无核心英文硬编码`,
    );
  });

  it("I18N_INVENTORY 的 key/unused 数就是签入基线里的数", () => {
    const baseline = JSON.parse(read("baseline/i18n-keys.json")) as {
      total: number;
      unusedTotal: number;
    };
    const doc = read("I18N_INVENTORY.md");
    expect(doc).toContain(`各有 ${baseline.total} 个完全一致的 leaf key`);
    expect(doc).toContain(`${baseline.unusedTotal} 个已审阅 unused key`);
  });

  it("BEHAVIOR_CONTRACTS 声明的组数就是实际的组数", () => {
    const doc = read("BEHAVIOR_CONTRACTS.md");
    const groups = [...doc.matchAll(/^## ([A-Z])\. /gm)].map((m) => m[1]);
    expect(groups.length).toBeGreaterThan(10);
    const last = groups.at(-1);
    expect(doc).toContain(`全表 **A–${last} 共 ${groups.length} 组**`);
  });

  it("PARITY_GAPS 顶部的状态和总清单里的状态一致", () => {
    const doc = read("PARITY_GAPS.md");
    const rows = [...doc.matchAll(/^\| [A-Z]+-\d+\s*\| P\d\s*\| (\w+)\s*\|/gm)];
    expect(rows.length).toBeGreaterThan(20);
    const open = rows.filter((m) => m[1] !== "DONE");
    if (open.length === 0) {
      // 全 DONE 时不能再自称「未完成清单」——那会让读者以为还有活没干。
      expect(doc).toContain(`第 5 节 ${rows.length} 个 ID **全部 DONE**`);
    } else {
      expect(doc).not.toContain("全部 DONE");
    }
  });

  it("openapi 快照 README 的路径/schema/router 数与签入快照一致", () => {
    const snapshot = JSON.parse(read("baseline/openapi.snapshot.json")) as {
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };
    const doc = read("baseline/openapi.snapshot.README.md");
    expect(doc).toContain(
      `${Object.keys(snapshot.paths).length} 条路径 / ${
        Object.keys(snapshot.components.schemas).length
      } 个 schema`,
    );

    // router 数只在 backend 也在 checkout 里时校验：本模块必须能独立工作。
    let app: string;
    try {
      app = read("../backend/app/gateway/app.py");
    } catch {
      return;
    }
    const all = [...app.matchAll(/^(\s*)app\.include_router\(/gm)];
    const conditional = all.filter((m) => (m[1] ?? "").length > 4).length;
    expect(doc).toContain(
      `其余 ${all.length - conditional} 个 router 无条件挂载`,
    );
  });

  it("遗留阶段命名清单既没漏项，也没多出新的", () => {
    const doc = read("ARCHITECTURE.md");
    const dirs = readdirSync(join(ROOT, "tests/unit"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => /^(?:wp\d+|m\d+[ab]?)$/.test(name))
      .sort();
    expect(dirs.length).toBeGreaterThan(0);

    // 文档必须覆盖到区间两端和 m7 这类单点，漏了就等于清单在说谎。
    const workPackages = dirs.filter((name) => name.startsWith("wp"));
    expect(doc).toContain(
      `\`tests/unit/${workPackages[0]}\` … \`tests/unit/${workPackages.at(-1)}\``,
    );
    expect(doc).toContain(
      `${workPackages.length} 个按迁移工作包编号的单测目录`,
    );
    for (const name of dirs.filter((n) => !n.startsWith("wp"))) {
      expect(doc).toContain(`\`tests/unit/${name}\``);
    }

    // 反方向：不许再添新的阶段命名目录，清掉一个就要同步改文档。
    expect(dirs).toEqual([
      "m7",
      "wp02",
      "wp03",
      "wp04",
      "wp05",
      "wp06",
      "wp07",
      "wp08",
      "wp09",
      "wp10",
      "wp11",
      "wp12",
    ]);
  });

  it("SSE golden trace 的帧数就是签入文件里的帧数", () => {
    const trace = read("tests/fixtures/streams/deerflow-create.sse");
    const events = [...trace.matchAll(/^event: *(\S+)/gm)].map((m) => m[1]);
    const counts = new Map<string, number>();
    for (const name of events) counts.set(name, (counts.get(name) ?? 0) + 1);
    const doc = read("tests/fixtures/streams/README.md");
    expect(doc).toContain(`${events.length} 个事件帧`);
    for (const [name, count] of counts) {
      expect(doc).toContain(`\`${name}\` ${count}`);
    }
  });
});
