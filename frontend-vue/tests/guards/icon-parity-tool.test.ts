/*
  【文件职责】     钉 scripts/icon-parity.mjs 自己的形状：三处解析都不能静默给 0。
  【架构位置】     测试（守卫）
  【主要导出】     无
  【依赖关系】     scripts/icon-parity.mjs
  【边界与注意】   **这条守的是工具，不是产品。**

                   wave 68 一轮内，同一把新尺子踩了三次「算出来的 0 和没算的 0
                   长得一样」（线索 176/195）：`dom-parity` 不报连上几个元素、
                   超时后静默返回空数据、不校验落地 URL。`icon-parity` 同源——
                   它的结论全部建立在两张别名表和两棵源码树上，任何一处解析不出来，
                   报告都会变成一句轻飘飘的「无差异」。

                   所以它自己内置了 exit 2 的形状断言；这条守卫钉的是
                   **那些断言还在**，而不是重跑一遍它。缺了上游时它退出 0，
                   本条也随之只检查源码，不执行。
*/

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync("scripts/icon-parity.mjs", "utf8");

describe("icon-parity 自己的形状断言", () => {
  it("别名表解析不出来时退出，不是继续跑出「无差异」", () => {
    expect(source).toContain("别名表没解析出来");
    // 探针是两个**已知答案**的别名：这两条一旦对不上，整张表就不可信。
    expect(source).toContain('"CheckCircleIcon", "CircleCheckBig"');
    expect(source).toContain('"CheckCircle2", "CircleCheck"');
    expect(source).toContain("process.exit(2)");
  });

  it("图标集合解析不出来时退出", () => {
    expect(source).toContain("图标集合没解析出来");
    expect(source).toMatch(/ri\.size < \d+ \|\| vi\.size < \d+/);
  });

  it("上游缺席时退出 0，不让任何入口变红", () => {
    expect(source).toContain("这是顾问工具，不进任何门禁");
    expect(source).toContain("process.exit(0)");
  });

  it("字形那一档从 import 收集，不从写了尺寸的那些收集", () => {
    /*
      第一版拿 `icons()`（只记写了尺寸的）当「用没用过这颗」，
      把 composer 明明在用的 `Zap` 报成「只有 React 用」。
    */
    expect(source).toContain("lucide-(?:react|vue-next)");
  });

  it("豁免面不进报告", () => {
    // 落地页 / docs / blog 双向豁免，它们独占的图标会把真信号淹掉。
    expect(source).toMatch(/EXEMPT = new Set\(\[[^\]]*"landing"/);
  });
});
