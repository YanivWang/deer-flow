/*
  【文件职责】     钉住文件头里**可机械核对**的那几条断言：`【主要导出】` 点名的符号
                   必须真的被导出；`【依赖关系】` 说「无」的必须真的零 import。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     checkout 里 SCAN_ROOTS 下的 .ts/.mts/.mjs（见下方 SCAN_ROOTS 注释）
  【边界与注意】   **`【主要导出】` 此前零消费者。** 全模块 478 份文件写着它，
                   而只有 `【架构位置】` 有人读（`tests/architecture.test.ts` 的
                   L2 那一条）。wave 60 逐条量了一遍，七份文件点名的符号在
                   checkout 里只剩自己那一行——`provideChainOfThought` /
                   `confettiOrigin` / `updateFlickeringOpacities` /
                   `createFrameBuffer` / `SKILLS_CATALOG_QUERY_KEY` /
                   `probeAuthSession` / `isEditableEventTarget`。
                   七条**全都是写下那天就错的**（真名在同一个 diff 里、
                   多数就在错行下面三行），不是后来改名漂掉的。

                   **只钉一个方向：点名的必须存在。** 反过来「导出了却没写进头」
                   不钉——`主要`两个字就是说它是索引不是全集，钉全集会把
                   每加一个内部 helper 都变成改注释。

                   **例外是自己写了数量的那几份**（wave 106）：`… 等 9 个` 不是
                   索引，是**声称全集有多大**，而它同样能从源码算出来。9 份文件
                   这么写，实测 `app/core/threads/utils.ts` 写着「等 8 个」、
                   实际 9 个——`documentTitleOfThread` 是 `84108b5f`（2026-08-31）
                   加的，头没跟着改，此后每一轮门禁都是绿的。判据自选口径、
                   **零豁免**：不写数字的一律不受影响，写了就得对。

                   **只判「长得像标识符」的 token。** 头里混着散文
                   （`browser API helpers`、`list/get/create Agent`、`Nitro API route`），
                   判据取三种命名法：camelCase、多驼峰 PascalCase、带下划线的全大写。
                   全小写单词（helpers/errors/config）与纯首字母缩写（MCP/CLI/GET/API）
                   一律跳过——它们是散文，不是名字。**豁免表为空，才说明收口选对了**
                   （线索 180）。具体扫到多少份、多少个 token **有意不写在这里**：
                   那种数字不承重，写下来必然过期（线索 179）；量它的是下面
                   「形状先断言再计算」那条用例，跑一次就有当下的读数。

                   ~~**`tests/` 有意不在范围里**：那边同一行写的是「被测对象是谁」
                   （`probeArtifactAction 回归`），不是「本文件导出什么」，
                   同一条规则套上去会产 14 条误报。~~ **⚠️ 这条政策 wave 105 已经推翻，
                   原文留在这里是因为它解释了那 13 处是怎么来的。** 当时的判断是
                   「两种约定各自成立，只是不能共用一条判据」——而**代价没算**：
                   `tests/` 下 195 份文件因此一份都没扫过，占扫描面的 73%，
                   且没有任何机器会发现（线索 229）。wave 105 的做法不是给它配一条
                   第二判据，而是**把那 12 份改成仓库既定写法**（`无；Vitest cases`——
                   被测对象本来就写在 `【文件职责】` 与 `【依赖关系】` 里，信息不丢），
                   于是一条判据就够了。**现在 `tests/` 在 SCAN_ROOTS 里**，
                   见下方那段注释。

                   **形状先断言再计算**（线索 176）：扫不到文件、没有一个
                   token 能判、或者某份文件解析出零导出却点了名，都直接红——
                   一个算出来的 0 和一个没算的 0 长得一模一样。

                   **`【依赖关系】` 整栏有意不钉，只钉「无」那一档。** wave 61 把这一栏
                   逐条读了一遍：它同一个字段里混着**四种**东西——「我 import 什么」
                   （`cn`、`Reka DialogRoot`）、「谁 import 我」（`被 Badge.vue 引用`，
                   20 份写着「被产品组件显式导入」）、一个指路（23 份写「见下方 import。」）、
                   和散文（`零运行时依赖，纯 type-only`）。**方向都不统一的字段没有单一真值**，
                   要判就得先分类，而分类器的豁免表会比门禁本身长（线索 180）。
                   **「无 / 零依赖」是这一栏里唯一可证伪的一档**：31 份文件这么写，
                   实测 31 份全对——**这是「量过、成立、并且从此有机器看着」，
                   不是「没查」**。

                   **`【文件职责】` 与 `【边界与注意】` 整栏不可能上门禁，理由写在这里
                   免得下一轮再问一遍**：它们是**解释**，不是断言——「这个文件干什么」
                   「为什么这么写」没有可判真假的形式。它们里面**引用**的东西
                   （路径、上游 file:line、行数、make target、裸文件名、词典 key）
                   另有五条守卫在管（doc-references / upstream-citations /
                   upstream-zero-claims / doc-facts / i18n）。**剩下的就是散文，
                   靠的是读它的人**——wave 57/58/59/60 那几条正是这么翻出来的，
                   而那不是门禁能替代的工作。

                   `【架构位置】` 在 `tests/architecture.test.ts` 里，不在这里：
                   L2 那一档双向钉死（自称 L2 的集合 == `l2Files`），
                   L1/L3 有意不钉，理由写在那份文件的 L2 段前面。

                   **早年的 `【对应 frontend/】` 那一栏已经不存在了**——`fa2cde27`
                   写过，现在整个 checkout 里一处都没有。所以它不列进
                   HEADER_MARKERS：写进来既没有任何文件会用到，又会让
                   `make standalone-check`（P0 门禁）把这份守卫自己当成一处
                   跨应用引用。哪天要复活那一栏，连同这句一起改。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkoutFiles } from "../../scripts/lib/checkout-files.mjs";
import { stripComments } from "../../scripts/lib/strip-comments.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

const MARKER = "【主要导出】";
const HEADER_MARKERS = [
  "【文件职责】",
  "【架构位置】",
  "【主要导出】",
  "【依赖关系】",
  "【边界与注意】",
];

/*
  扫描面。`config/` 与 `shared/` 是 wave 84 补的：两者都是这个应用的生产源码
  （Nuxt 4 的 `shared/` 同时被 app 与 server 自动导入，`config/routes.ts` 被
  nuxt.config 消费），而此前它们完全在这条门禁之外。

  **补进来当场红了一条**，而且不是欠账：`config/routes.ts` 的 `buildProxyRules`
  明明导出着，是这条门禁自己的剥注释函数把它吃了（见下方 `stripJs` 那段）。
  换成认字符串的剥法之后**零违规**——头里点名的符号全都真的导出着。
  **扩扫描面最先量到的是尺子自己**（线索 213）。

  仍然在外面的，是**仓库根上的 config 文件**（playwright.*.config.ts、nuxt.config.ts、
  vitest.config.ts、eslint.config.mjs）——那一行按惯例写的是散文（"Playwright config"），
  不是符号名。它们是**根上的文件**，不属于任何顶层目录，天然不在 SCAN_ROOTS 的射程里。

  **wave 105 补上 `tests`。** 在那之前这句注释写的是「仍然在外面的两类」，
  而实际是**三类**——`tests/` 下有 **195 份**文件带着 `【主要导出】` 头，
  这条门禁一份都没扫过，**而且没有任何机器会发现这件事**
  （线索 229 的形状：判据由一个看不见新东西的扫描面撑着；
  wave 104 刚在 `baseline` 那张名单上撞过同一形状）。
  扩进来当场报出 **13 处**：12 份 spec 把**被测符号**写在了 `【主要导出】`
  （`probeArtifactAction 回归` 之类，而它们一个 export 都没有），
  加 `mock-api.ts` 的 `MOCK_*` 通配写法。前者按仓库既定写法改成「无；Vitest cases」
  （被测对象本来就写在 `【文件职责】` 与 `【依赖关系】` 里），后者列全四个常量。
*/
const SCAN_ROOTS = [
  "app",
  "config",
  "packages",
  "scripts",
  "server",
  "shared",
  "tests",
];

/**
 * 有意不扫的顶层目录，**每一条都要写出理由**。
 * 它与 `SCAN_ROOTS` 合起来必须**恰好等于 git 跟踪的顶层目录**——
 * 少了哪一个，那个目录下的文件头就静默不受检查（wave 105 之前 `tests/` 正是如此）。
 */
const EXCLUDED_ROOTS: Record<string, string> = {
  baseline: "签入的数据文件，不是源码",
  public: "静态资源与录制下来的 demo，不是本仓源码",
  examples: "独立的消费方样例，由 make consumer-check 单独装起来跑",
};

const sourceFiles = checkoutFiles(SCAN_ROOTS, { cwd: root }).filter((file) =>
  /\.(ts|mts|mjs)$/.test(file),
);

/** `【主要导出】` 那一行加上它后面所有缩进续行，拼成一句。 */
function exportBlockOf(source: string): string | null {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.includes(MARKER));
  if (start < 0) return null;
  const head = lines[start] as string;
  const parts = [head.slice(head.indexOf(MARKER) + MARKER.length)];
  for (const line of lines.slice(start + 1)) {
    if (HEADER_MARKERS.some((marker) => line.includes(marker))) break;
    if (/^\s*(\*\/|-->)/.test(line)) break;
    if (!line.trim()) break;
    if (!/^\s{4,}/.test(line)) break;
    parts.push(line);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/*
  注释要先剥掉，否则头注释自己提到的名字会把被测对象救活——线索 174 里
  `baseline-keys-consumed` 的第一版就是这样假绿的。

  **不能用正则剥。** 这里原来写的是
  `source.replace(/\/\*[\s\S]*?\*\//g, "")`，它不认字符串：
  `config/routes.ts` 里的 `"/workspace/**"` 开了一个假注释，一口吃掉 1886 个字符，
  连 `export function buildProxyRules` 一起。扫描面内有 8 份文件的字符串里带
  `/*`，也就是说这条门禁一直在半截源码上工作——`【主要导出】` 那一半会误报，
  而 `【依赖关系】 无` 那一半会**静默放过**（被吃掉的 import 数不到）。
  现在用 `scripts/lib/strip-comments.mjs`，按字符走、跟踪引号与转义，
  与 `standalone-check` 共用一份（wave 84）。
*/
const stripJs = (source: string): string =>
  stripComments(source, ["line", "block"]);

function exportedNamesOf(source: string): Set<string> {
  const code = stripJs(source);
  const names = new Set<string>();
  const collect = (pattern: RegExp) => {
    for (const match of code.matchAll(pattern)) names.add(match[1] as string);
  };
  collect(
    /^\s*export\s+(?:declare\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm,
  );
  collect(
    /^\s*export\s+(?:declare\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm,
  );
  collect(
    /^\s*export\s+(?:declare\s+)?(?:interface|enum)\s+([A-Za-z_$][\w$]*)/gm,
  );
  collect(/^\s*export\s+(?:declare\s+)?type\s+([A-Za-z_$][\w$]*)\s*[=<]/gm);
  collect(
    /^\s*export\s+(?:declare\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
  );
  collect(
    /^\s*export\s+default\s+(?:async\s+)?(?:function\s*\*?|class)\s+([A-Za-z_$][\w$]*)/gm,
  );
  for (const match of code.matchAll(/^\s*export\s+(?:type\s+)?\{([^}]*)\}/gm)) {
    for (const piece of (match[1] as string).split(",")) {
      const token = piece.trim();
      if (!token) continue;
      const renamed = /\bas\s+([A-Za-z_$][\w$]*)\s*$/.exec(token);
      names.add(
        renamed ? (renamed[1] as string) : token.replace(/^type\s+/, "").trim(),
      );
    }
  }
  if (/^\s*export\s+default\b/m.test(code)) names.add("default");
  return names;
}

/** 三种命名法才算「点了一个名字」，其余按散文放过。 */
function looksLikeSymbol(token: string): boolean {
  return (
    /^[a-z][a-z0-9]*[A-Z]/.test(token) ||
    /^[A-Z][a-z0-9]+[A-Z]/.test(token) ||
    /^[A-Z][A-Z0-9]*_[A-Z0-9_]*$/.test(token)
  );
}

interface Declaration {
  file: string;
  block: string;
  tokens: string[];
  exported: Set<string>;
  reExports: boolean;
  /** 头里自己写下的导出总数（`… 等 9 个`），没写就是 null。 */
  claimedCount: number | null;
}

const declarations: Declaration[] = [];
for (const file of sourceFiles) {
  const source = readFileSync(`${root}${file}`, "utf8");
  const block = exportBlockOf(source);
  if (block === null) continue;
  const tokens = [
    ...new Set([...block.matchAll(/[A-Za-z_$][\w$]*/g)].map((m) => m[0])),
  ].filter(looksLikeSymbol);
  const counted = /等\s*(\d+)\s*个/.exec(block);
  declarations.push({
    file,
    block,
    tokens,
    exported: exportedNamesOf(source),
    reExports: /^\s*export\s+\*/m.test(stripJs(source)),
    claimedCount: counted ? Number(counted[1]) : null,
  });
}

/** `【依赖关系】` 里唯一可证伪的一档：整栏就一个「无 / 零依赖」。 */
function claimsNoDependency(source: string): boolean {
  const value = /【依赖关系】\s*(.+)/.exec(source)?.[1]?.trim();
  return value !== undefined && /^(无|零依赖)[。；;]?$/.test(value);
}

/** 静态与动态 import 的 specifier；注释先剥掉（线索 174）。 */
function importSpecifiersOf(source: string): string[] {
  return [
    ...new Set(
      [
        ...stripJs(source).matchAll(
          /(?:from|import)\s*\(?\s*["']([^"']+)["']/g,
        ),
      ].map((match) => match[1] as string),
    ),
  ];
}

describe("扫描面", () => {
  it("SCAN_ROOTS 与 EXCLUDED_ROOTS 恰好划分 checkout 里的顶层目录", () => {
    const tops = new Set(
      checkoutFiles(["."], { cwd: root })
        .map((file) => file.split("/"))
        .filter((parts) => parts.length > 1)
        .map((parts) => parts[0] as string),
    );
    const declared = [...SCAN_ROOTS, ...Object.keys(EXCLUDED_ROOTS)].sort();
    expect(
      declared,
      "checkout 里多了或少了一个顶层目录：要扫的进 SCAN_ROOTS，" +
        "有意不扫的进 EXCLUDED_ROOTS 并写出理由——" +
        "不表态的话那个目录下的文件头就静默不受检查（wave 105 之前 tests/ 正是如此，" +
        "195 份带头文件一份没扫过，而且没有任何机器会发现）",
    ).toEqual([...tops].sort());
  });

  it("EXCLUDED_ROOTS 的每条理由都不是空话", () => {
    const thin = Object.entries(EXCLUDED_ROOTS).filter(
      ([, why]) => why.trim().length < 8,
    );
    expect(thin, "有意不扫要写得出为什么").toEqual([]);
  });
});

describe("文件头的【依赖关系】", () => {
  const claiming = sourceFiles
    .concat(
      checkoutFiles(["app"], { cwd: root }).filter((file) =>
        file.endsWith(".vue"),
      ),
    )
    .map((file) => ({ file, source: readFileSync(`${root}${file}`, "utf8") }))
    .filter((entry) => claimsNoDependency(entry.source));

  it("确实有文件这么写（形状先断言再计算）", () => {
    expect(claiming.length).toBeGreaterThan(20);
  });

  it("写「无」的文件真的一个 import 都没有", () => {
    const broken = claiming
      .filter((entry) => importSpecifiersOf(entry.source).length > 0)
      .map(
        (entry) =>
          `${entry.file}：头里写「无」，实际 import ${importSpecifiersOf(entry.source).join(" ")}`,
      );
    expect(broken).toEqual([]);
  });
});

describe("文件头的【主要导出】", () => {
  it("扫到的文件与可判 token 都不是零（形状先断言再计算）", () => {
    expect(sourceFiles.length).toBeGreaterThan(300);
    expect(declarations.length).toBeGreaterThan(200);
    const named = declarations.filter((entry) => entry.tokens.length > 0);
    expect(named.length).toBeGreaterThan(150);
    expect(
      named.reduce((sum, entry) => sum + entry.tokens.length, 0),
    ).toBeGreaterThan(400);
  });

  it("点了名的文件必须真的解析出导出", () => {
    const silent = declarations
      .filter((entry) => entry.tokens.length > 0 && entry.exported.size === 0)
      .map((entry) => entry.file);
    expect(
      silent,
      "这些文件的头点了符号，却一个 export 都解析不出来——先修解析再谈比对",
    ).toEqual([]);
  });

  it("每个点名的符号都真的被这个文件导出", () => {
    const broken: string[] = [];
    for (const entry of declarations) {
      /*
        `export *` 的转出名要跨文件解析，当前模块里一个都没有（上面那条
        形状断言之外再兜一层）；真出现时先把这里补成解析，不要静默放过。
      */
      if (entry.reExports) continue;
      for (const token of entry.tokens) {
        if (!entry.exported.has(token)) {
          broken.push(
            `${entry.file}：【主要导出】点名了 ${token}，文件没有导出它`,
          );
        }
      }
    }
    expect(broken).toEqual([]);
  });

  /*
    写了「等 N 个」就不再是索引，而是一句**关于全集**的断言，而且能算。
    这一档与上面「只钉点名的存在」不冲突：不写数字的文件一行都不受影响。
    `export *` 的转出名解析不了，所以那种文件写数字也不判——真出现时
    上面那条 `starred` 用例会先红。
  */
  const counting = declarations.filter(
    (entry) => entry.claimedCount !== null && !entry.reExports,
  );

  it("确实有文件在头里写导出总数（形状先断言再计算）", () => {
    expect(
      counting.length,
      "一份写数量的文件都没扫到——`等 N 个` 的取法失效了",
    ).toBeGreaterThan(5);
  });

  it("写了「等 N 个」的，N 必须等于实际导出数", () => {
    const wrong = counting
      .filter((entry) => entry.claimedCount !== entry.exported.size)
      .map(
        (entry) =>
          `${entry.file}：头里写「等 ${entry.claimedCount} 个」，实际导出 ${entry.exported.size} 个`,
      );
    expect(
      wrong,
      "写数字就得对；不想维护这个数就把「等 N 个」去掉，判据自选口径",
    ).toEqual([]);
  });

  it("当前没有任何文件靠 export * 绕过比对", () => {
    const starred = declarations
      .filter((entry) => entry.reExports && entry.tokens.length > 0)
      .map((entry) => entry.file);
    expect(
      starred,
      "有文件同时用 export * 且在头里点名——把上面那条 continue 改成真解析",
    ).toEqual([]);
  });
});
