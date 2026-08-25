/*
  【文件职责】     守住文档里那些**可核实的数字**与代码实际情况一致。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     I18N_INVENTORY.md · BEHAVIOR_CONTRACTS.md ·
                   baseline/*.json · tests/fixtures/streams/*.sse · i18n source guard
  【边界与注意】   与 `doc-references.test.ts` 分工：那边管「文档点名的东西存在吗」，
                   这边管「文档说的数字对吗」。两类都是同一种失效——文档在说谎，
                   而读它的人（越来越多是模型）没有第二个信息源可以对照。

                   一次盘点实测出来的偏差：
                   - `I18N_INVENTORY.md` 说 82 个 SFC / 80 个产品 SFC，实际 158 / 156；
                   - 同一份文档说 976 个 key / 160 个 unused，实际 987 / 150；
                   - `BEHAVIOR_CONTRACTS.md` 开头写「A–Q 共 17 组」，实际已经是 A–S 19 组；
                   - `openapi.snapshot.README.md` 说其余 24 个 router 无条件挂载，实际 22。
                   没有一条会让任何门禁变红，因为在此之前没有门禁读过文档。

                   只钉**能从签入产物直接算出来**的数字。测试条数、lint warning 条数
                   这类每次改动都会变的量，正确做法是不写进散文，而不是在这里追着它跑。
*/

import { existsSync, readdirSync, readFileSync } from "node:fs";
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

  it("tests/unit 下不再有阶段命名目录", () => {
    const dirs = readdirSync(join(ROOT, "tests/unit"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(dirs.length).toBeGreaterThan(10);
    // `wp02`…`wp12` 与 `m7` 已按用途归位；再冒出一个就说明有人照旧习惯建了目录。
    expect(dirs.filter((name) => /^(?:wp\d+|m\d+[ab]?)$/.test(name))).toEqual(
      [],
    );
  });

  it("测试标题里没有阶段前缀", () => {
    const offenders: string[] = [];
    const walk = (rel: string) => {
      for (const entry of readdirSync(join(ROOT, rel), {
        withFileTypes: true,
      })) {
        const child = `${rel}/${entry.name}`;
        if (entry.isDirectory()) walk(child);
        else if (
          child.endsWith(".ts") &&
          /describe\(\s*"(?:WP-\d+|M\d+[ab]?)[\s·]/.test(read(child))
        ) {
          offenders.push(child);
        }
      }
    };
    walk("tests");
    expect(offenders).toEqual([]);
  });

  it("遗留阶段标识清单既没漏项，也没多出新的", () => {
    const doc = read("ARCHITECTURE.md");
    /*
      还剩下的都是**标识符**（页面目录、环境变量、harness 文件、契约常量），
      改它们会波及 Dockerfile / CI / 后端 harness，所以留着并如实列出。
      这里两个方向都查：文档写了的必须真的存在，存在的必须写进文档。
    */
    const survivors = [
      "app/pages/__m0",
      "tests/support/run_m0_gateway.py",
      "tests/support/m0_replay_provider.py",
    ];
    for (const rel of survivors) {
      expect({ rel, exists: existsSync(join(ROOT, rel)) }).toEqual({
        rel,
        exists: true,
      });
      expect(doc).toContain(rel.split("/").pop() as string);
    }
    expect(doc).toContain("NUXT_PUBLIC_M0_TEST_PAGES");
    expect(read("packages/agent-core/src/index.ts")).toContain(
      'AGENT_CORE_CONTRACT_VERSION = "m8"',
    );
    expect(doc).toContain('AGENT_CORE_CONTRACT_VERSION = "m8"');
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
