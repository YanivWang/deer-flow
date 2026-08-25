/*
  【文件职责】     把每个场景在两个应用上的样本比出差异，并钉住一份只能缩短的清单。
  【架构位置】     对照套件（e2e-parity）
  【主要导出】     无；Playwright 用例
  【依赖关系】     support/capture.ts · support/scenarios.ts · baseline/parity-diff.json
  【边界与注意】   这就是「还差哪些」的机器答案。它**不是**一份写在散文里的清单，
                   因为散文清单会先于代码过期，也会被下一个读者当成已经决定不做的东西。

                   钉的是差异本身而不是差异条数。条数只能告诉你「变多了」，
                   而清单能告诉你变的是哪一条；更重要的是，条数相同、内容全换了
                   这种情况，按条数比对完全看不见。

                   一次跑完全部场景写进**一份**基线，是为了让「某个场景消失了」
                   和「某个场景多出来了」同样会红。分成一个场景一份文件的话，
                   删掉一份文件是静默的。

                   刷新基线：`make parity-accept`。刷新前先看清楚每一条变化是修好了
                   还是新坏了——accept 只是记录，不是判断。
*/

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { diffAriaLines } from "../../scripts/lib/aria-parity.mjs";
import { captureScenario, type GeometrySample } from "./support/capture";
import { reactAppPresent } from "./support/react-preview";
import {
  DEFAULT_DIMENSION,
  PARITY_SCENARIOS,
  type ParityDimension,
} from "./support/scenarios";

const VUE_APP = process.env.E2E_APP_URL ?? "http://localhost:3115";
const REACT_APP = process.env.E2E_REACT_APP_URL ?? "http://localhost:3116";
const ACCEPT = process.env.PARITY_ACCEPT === "1";

const BASELINE = new URL("../../baseline/parity-diff.json", import.meta.url);
const REPORT = new URL(
  "../../test-results/e2e-parity/report.json",
  import.meta.url,
);

type DiffEntry = {
  ariaOnlyReact: string[];
  ariaOnlyVue: string[];
  requestsOnlyReact: string[];
  requestsOnlyVue: string[];
  /** 锚点的几何与色板差异，一行一处。 */
  geometry: string[];
};

/**
 * 几何容差。
 *
 * 不能要求逐像素相等：两边的 primitive 各有自己的内边距与边框实现，那正是
 * ARCHITECTURE 里只对齐可观察行为的三处之一。但也不能没有判据。
 *
 * 2px 是先定后测的。测完的事实是：当前 22 处几何差异里最小的 |Δ| 是 8px，
 * 最大 88.2px，**2~8px 这一档一条都没有**——也就是说这个阈值现在没有压住任何
 * 贴边的东西，它挡掉的只会是真正的零头。哪天有差异落进这一档，要做的是回去看
 * 那一处，而不是顺手把数字调大。
 */
const GEOMETRY_TOLERANCE_PX = 2;

test.skip(
  !reactAppPresent,
  "兄弟 React 应用不在 checkout 里；本模块的其余门禁都不依赖它。",
);

function key(scenarioId: string, dimension: ParityDimension) {
  return `${scenarioId}/${dimension.viewport}/${dimension.theme}/${dimension.locale}`;
}

/** 多重集差异，与 aria 用同一套办法：同一条出现三次和出现一次不是一回事。 */
function diffMultiset(react: string[], vue: string[]) {
  const count = (items: string[]) => {
    const map = new Map<string, number>();
    for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
    return map;
  };
  const reactCount = count(react);
  const vueCount = count(vue);
  const onlyReact: string[] = [];
  const onlyVue: string[] = [];
  for (const [item, n] of reactCount) {
    for (let i = 0; i < n - (vueCount.get(item) ?? 0); i++)
      onlyReact.push(item);
  }
  for (const [item, n] of vueCount) {
    for (let i = 0; i < n - (reactCount.get(item) ?? 0); i++)
      onlyVue.push(item);
  }
  return { onlyReact: onlyReact.sort(), onlyVue: onlyVue.sort() };
}

function diffGeometry(
  react: Record<string, GeometrySample | null>,
  vue: Record<string, GeometrySample | null>,
) {
  const lines: string[] = [];
  for (const label of [
    ...new Set([...Object.keys(react), ...Object.keys(vue)]),
  ].sort()) {
    const r = react[label] ?? null;
    const v = vue[label] ?? null;
    if (!r || !v) {
      lines.push(
        `${label} 取样缺失 React=${r ? "有" : "无"} Vue=${v ? "有" : "无"}`,
      );
      continue;
    }
    for (const field of ["x", "y", "width", "height"] as const) {
      const delta = Math.round((v[field] - r[field]) * 10) / 10;
      if (Math.abs(delta) > GEOMETRY_TOLERANCE_PX) {
        lines.push(
          `${label} ${field} React=${r[field]} Vue=${v[field]} Δ${delta}`,
        );
      }
    }
    for (const field of ["color", "background", "fontSize"] as const) {
      if (r[field] !== v[field]) {
        lines.push(`${label} ${field} React=${r[field]} Vue=${v[field]}`);
      }
    }
  }
  return lines;
}

test("每个场景的双向差异都与签入的清单一致", async ({ context }) => {
  test.setTimeout(600_000);

  const entries: Record<string, DiffEntry> = {};

  for (const scenario of PARITY_SCENARIOS) {
    for (const dimension of scenario.dimensions ?? [DEFAULT_DIMENSION]) {
      // 一个应用一个 page：mock 路由、init script 与视口都是 page 级状态。
      const vuePage: Page = await context.newPage();
      const reactPage: Page = await context.newPage();
      const vue = await captureScenario(vuePage, VUE_APP, scenario, dimension);
      const react = await captureScenario(
        reactPage,
        REACT_APP,
        scenario,
        dimension,
      );
      await vuePage.close();
      await reactPage.close();

      const aria = diffAriaLines(react.aria, vue.aria);
      const requests = diffMultiset(react.requests, vue.requests);
      entries[key(scenario.id, dimension)] = {
        ariaOnlyReact: aria.onlyReact,
        ariaOnlyVue: aria.onlyVue,
        requestsOnlyReact: requests.onlyReact,
        requestsOnlyVue: requests.onlyVue,
        geometry: diffGeometry(react.geometry, vue.geometry),
      };
    }
  }

  mkdirSync(dirname(REPORT.pathname), { recursive: true });
  writeFileSync(REPORT, JSON.stringify(entries, null, 2));

  if (ACCEPT) {
    writeFileSync(
      BASELINE,
      JSON.stringify(
        {
          $comment:
            "React 与 Vue 在每个对照场景上的双向差异。这份清单只能缩短：修好一条就从这里删一条，" +
            "新出现一条会让 e2e-parity 立刻红。空数组是目标状态，不是「还没测」。" +
            "刷新用 make parity-accept，刷新前先逐条看清楚是修好了还是新坏了。" +
            "键是 场景/断点/主题/语言；aria* 是可访问性树的双向逐行差异，" +
            "requests* 是产品 API 请求的多重集差异，geometry 是锚点的盒模型与色板差异。",
          entries,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  expect(existsSync(BASELINE), "基线不存在：先跑一次 make parity-accept").toBe(
    true,
  );
  const baseline = (await import(BASELINE.href, { with: { type: "json" } }))
    .default as { entries: Record<string, DiffEntry> };

  expect(
    entries,
    "对照差异与 baseline/parity-diff.json 不一致：修好的从清单里删掉，" +
      "新出现的先弄清楚是真差异还是取样不稳定，再决定是修代码还是 make parity-accept。",
  ).toEqual(baseline.entries);
});

/*
  取样稳定性的**测量**，不是偏好。请求序列如果两次一致，将来就可以把判据从
  多重集收紧成顺序；不一致的话，收紧只会得到一份随机变红的门禁。
  这里如实把测量结果留在报告里，而不是先假设一个答案。
*/
test("同一应用两次取样的请求序列", async ({ context }) => {
  test.setTimeout(180_000);
  const scenario = PARITY_SCENARIOS[0]!;
  const samples: Record<string, string[][]> = {};

  for (const [name, base] of [
    ["vue", VUE_APP],
    ["react", REACT_APP],
  ] as const) {
    samples[name] = [];
    for (let round = 0; round < 2; round++) {
      const page = await context.newPage();
      const capture = await captureScenario(
        page,
        base,
        scenario,
        DEFAULT_DIMENSION,
      );
      samples[name]!.push(capture.requests);
      await page.close();
    }
  }

  for (const [name, rounds] of Object.entries(samples)) {
    expect(
      rounds[1],
      `${name} 两次取样的请求序列不同：顺序判据在收紧之前必须先稳定。`,
    ).toEqual(rounds[0]);
  }
});
