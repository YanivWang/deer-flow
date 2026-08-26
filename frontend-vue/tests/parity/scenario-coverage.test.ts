/*
  【文件职责】     守住对照场景目录与 React 用例清单的对应关系。
  【架构位置】     对照测试（非产品门禁）
  【主要导出】     无
  【依赖关系】     tests/e2e-parity/support/scenarios.ts · baseline/parity-scenario-coverage.json ·
                   baseline/react-parity-scope.json · ../frontend/tests/e2e（缺席则整组跳过）
  【边界与注意】   坐标系用的是 React 自己的 spec 文件名，而不是我们自拟的一份功能清单。
                   自拟清单的问题是它只反映拟清单那天的理解，上游加了用例它不会变；
                   用 React 的用例清单当坐标系，「上游多守了一个行为」这件事会自动
                   变成一条待办，不需要任何人记得去加。

                   这里只钉**覆盖率**，不钉场景内容对不对——那要靠 e2e-parity 真跑一遍。
*/

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PARITY_SCENARIOS } from "../e2e-parity/support/scenarios";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const reactSpecs = join(repoRoot, "frontend/tests/e2e");
const upstreamPresent = existsSync(reactSpecs);

const read = (rel: string) =>
  JSON.parse(readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8"));

const coverage = read("baseline/parity-scenario-coverage.json") as {
  covered: string[];
  pending: string[];
  exempt: { id: string; route: string }[];
};
const scope = read("baseline/react-parity-scope.json") as {
  exemptRoutes: { routes: string[] };
  contentExemptRoutes: { routes: string[] };
};

function reactSpecIds() {
  return readdirSync(reactSpecs)
    .filter((name) => name.endsWith(".spec.ts"))
    .map((name) => name.slice(0, -".spec.ts".length))
    .sort();
}

describe("对照场景覆盖率", () => {
  it("目录里的 id 各不相同", () => {
    const ids = PARITY_SCENARIOS.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covered 就是目录本身，一个不多一个不少", () => {
    const ids = PARITY_SCENARIOS.map((scenario) => scenario.id).sort();
    expect(
      [...coverage.covered].sort(),
      "写进目录的场景要从 pending 移到 covered；从目录删掉的要移回去。",
    ).toEqual(ids);
  });

  it("三个桶互不重叠", () => {
    const exemptIds = coverage.exempt.map((entry) => entry.id);
    const all = [...coverage.covered, ...coverage.pending, ...exemptIds];
    expect(new Set(all).size).toBe(all.length);
  });

  it.skipIf(!upstreamPresent)("三个桶恰好划分 React 的用例清单", () => {
    const exemptIds = coverage.exempt.map((entry) => entry.id);
    const classified = [
      ...coverage.covered,
      ...coverage.pending,
      ...exemptIds,
    ].sort();
    expect(
      classified,
      "上游 spec 清单变了：新增的要进 pending（要做）或 exempt（在已豁免的路由上），" +
        "删掉的要从三个桶里一起移除。",
    ).toEqual(reactSpecIds());
  });

  it("每条豁免场景都落在一条已经豁免的路由上", () => {
    // exempt 不能是「暂时不想做」的别名。判据是它所在的路由**已经**在
    // react-parity-scope.json 里被豁免了；那份文件改了，这里会跟着红。
    const exemptRoutes = new Set([
      ...scope.exemptRoutes.routes,
      ...scope.contentExemptRoutes.routes,
    ]);
    for (const entry of coverage.exempt) {
      expect({
        id: entry.id,
        route: entry.route,
        exempted: exemptRoutes.has(entry.route),
      }).toEqual({ id: entry.id, route: entry.route, exempted: true });
    }
  });

  it("每个场景的步骤只用两边共有的定位方式", () => {
    /*
      class 名与组件库内部结构是 ARCHITECTURE 明写「只对齐可观察行为」的地方，
      用它们定位等于把 reka 与 radix 的实现差异写进场景，场景会在两边都不稳定。
    */
    /*
      先把属性值摘掉再判。属性值里出现点是正常的——`img[alt="diagram.png"]` 定位的是
      React 与 Vue 都写了的 alt 文本，不是 class。不摘的话这条守卫会把它误判成
      class 选择器，而它挡的本来就不是这个。
    */
    const withoutAttributeValues = (selector: string) =>
      selector.replaceAll(/=\s*(['"])(?:\\.|(?!\1).)*\1/g, "=…");
    const offenders: string[] = [];
    for (const scenario of PARITY_SCENARIOS) {
      for (const step of [...scenario.settle, ...(scenario.steps ?? [])]) {
        if (!("target" in step)) continue;
        if (
          "selector" in step.target &&
          /\.[a-z-]|\[class/i.test(withoutAttributeValues(step.target.selector))
        ) {
          offenders.push(`${scenario.id}: ${step.target.selector}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
