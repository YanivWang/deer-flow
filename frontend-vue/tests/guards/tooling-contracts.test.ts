/*
  【文件职责】     钉住工程底座里两条「错了很难看出来」的一致性：成组依赖的版本、
                   以及 Makefile 的 `.PHONY` 与实际 target 一一对应。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     package.json · Makefile
  【边界与注意】   **起因是一次真实的两小时弯路**（wave 63/64）：想给本仓量一次行覆盖率，
                   裸跑 `pnpm add -Dw @vitest/coverage-v8` 装到了 **5.0.0**，
                   而本仓的 vitest 是 **4.1.10**。报出来的是

                       AssertionError: coverageFilesDirectory is required

                   ——它出现在**每一个 worker** 上、一次 251 个未处理错误、
                   summary 是 `0/14416 statements`，而且三个 project（node / dom /
                   nuxt）全都一样。**看起来像「这套三-project 配置不支持覆盖率」，
                   实际是 v5 的 provider 在跟 v4 的核心说话。**
                   换成同一条 range 之后一次就过，`vitest.config.ts` 一个字都不用改。

                   **所以这里钉的不是「版本号是多少」，是「这两条 range 逐字相同」。**
                   钉具体版本号会让每次升级都要改守卫（`e2e-suite-contract.test.ts`
                   文件头点名的反模式）；钉「相同」只在真正出事的那一刻红——
                   有人只升其中一个，或者裸 `pnpm add` 抓了 latest。

                   **只钉 major/minor 层面的搭配**：pnpm 在同一条 caret range 里
                   把两者解析到差一个 patch（实测 vitest 4.1.10 + coverage 4.1.11）
                   是正常的，也实测能跑。真正会炸的是跨大版本。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../package.json", import.meta.url)),
    "utf8",
  ),
) as { devDependencies?: Record<string, string> };

const dev = packageJson.devDependencies ?? {};

/** 必须共用同一条 range 的成组依赖。 */
const LOCKSTEP: [string, string][] = [["vitest", "@vitest/coverage-v8"]];

describe("成组依赖的版本必须一起升", () => {
  it("形状先断言：清单非空，且这些包都还在 devDependencies 里", () => {
    // 清单清空时上面两个 for 都不进循环，断言全部落空却照样绿——
    // 这正是线索 176 说的「算出来的 0 和没算的 0 长得一模一样」。
    expect(LOCKSTEP.length).toBeGreaterThan(0);
    expect(Object.keys(dev).length).toBeGreaterThan(5);
    for (const group of LOCKSTEP) {
      for (const name of group) {
        expect(dev[name], `${name} 不在 devDependencies 里`).toBeDefined();
      }
    }
  });

  it("同组的 range 逐字相同", () => {
    for (const [left, right] of LOCKSTEP) {
      expect(
        dev[right],
        `${right} 与 ${left} 的 range 必须逐字相同——` +
          "版本错配时 vitest 报的是 `coverageFilesDirectory is required`，" +
          "看不出是版本问题。裸 `pnpm add` 会抓 latest，要写死 range。",
      ).toBe(dev[left]);
    }
  });
});

/*
  `.PHONY` 与实际 target 必须一一对应。

  两边都会单向烂掉，而且都不报错：
  - 声明了却没有对应 target —— 真去跑那一条时 make 报 "No rule to make target"，
    但只有跑它的人才会发现；
  - 有 target 却没声明 —— 目录里正好有个同名文件时 make 会**什么都不做**，
    这一条最阴，因为它「成功」了。

  wave 60 手工量过一次（53 : 53 全对），但**没有留下门禁**；wave 64 变异实测：
  把 `coverage:` 改名成 `coverageX:` 而 `.PHONY` 不动，当时一条用例都不红。
*/
const makefile = readFileSync(
  fileURLToPath(new URL("../../Makefile", import.meta.url)),
  "utf8",
);

function declaredPhony(): Set<string> {
  const match = /^\.PHONY:((?:[^\n\\]|\\\n)*)/m.exec(makefile);
  if (!match) throw new Error("Makefile 里找不到 .PHONY");
  return new Set(match[1]!.replace(/\\\n/g, " ").split(/\s+/).filter(Boolean));
}

function realTargets(): Set<string> {
  return new Set(
    [...makefile.matchAll(/^([a-z][a-z0-9-]*):/gm)].map((m) => m[1] as string),
  );
}

describe("Makefile 的 .PHONY 与 target", () => {
  const phony = declaredPhony();
  const targets = realTargets();

  it("形状先断言：两边都不是空的", () => {
    expect(phony.size).toBeGreaterThan(20);
    expect(targets.size).toBeGreaterThan(20);
  });

  it("声明的每一条都有对应 target", () => {
    expect(
      [...phony].filter((name) => !targets.has(name)).sort(),
      ".PHONY 里声明了但 Makefile 里没有这条 target",
    ).toEqual([]);
  });

  it("每一条 target 都被声明", () => {
    expect(
      [...targets].filter((name) => !phony.has(name)).sort(),
      "有 target 没进 .PHONY——同名文件存在时 make 会静默什么都不做",
    ).toEqual([]);
  });
});
