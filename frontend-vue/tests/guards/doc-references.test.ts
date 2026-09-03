/*
  【文件职责】     守住「文档里指名道姓的东西都真的存在」：make 命令、相对链接、测试路径。
  【架构位置】     门禁测试
  【主要导出】     无；Vitest cases
  【依赖关系】     Makefile · ../Makefile · 全部已跟踪的文本文件与 Markdown
  【边界与注意】   这条门禁是被现实逼出来的。`1209651f` 把 E2E 套件按用途重命名
                   （m0/m4a/m4b/m5/m6/m7/wp07…wp11 → e2e/e2e-stream/e2e-real/
                   e2e-browser/e2e-scheduled/…），同时删掉了整套迁移台账，
                   于是 `migration-check` 也不复存在。**文档一个字没改。**
                   结果是 README、ARCHITECTURE、REUSE 和当时的差异清单里躺着
                   20 个名字、上百处引用，照着敲全都是 make 的
                   “No rule to make target”——而所有门禁一路全绿，因为没有任何
                   一条检查读过文档。

                   判据只有一条：**能敲的命令必须存在**。（本文件自己提到旧名时
                   只写 target 名、不写成完整命令，否则它会把自己判红。）
                   为此要把两类文本分开：

                   - 指令（README/ARCHITECTURE/REUSE/各 README 配方）必须只出现
                     当前真实存在的 target；
                   - 历史记录写的是**当时**跑了哪条命令，是既成事实，把它们改成
                     今天的名字等于伪造记录。

                   历史区用 `<!-- historical-commands:begin/end -->` 显式圈出，
                   不用行号（行号会随任何一次编辑失效），也不靠「看起来像历史」猜。

                   识别规则：命令里的 target 名带连字符，或者整条命令被反引号/代码块
                   包住时参与检查。这样「Deerflow is AI and can make mistakes」这类散文
                   不会误报，而 `e2e-m7` 这类死名字跑不掉。
                   残留缺口：一个**没有连字符**、又**没被反引号包住**的已删除
                   target 仍会漏网。当前 Makefile 里的单词 target（verify、test、
                   build…）都还活着，所以这个缺口现在是空的；这里如实写出来，
                   而不是假装它不存在。

                   同一次清理里还翻出两类同形状的腐烂，一并守住：
                   - Markdown 相对链接指向已删除的文件（`app/core/PROVENANCE.md`
                     随迁移台账一起没了，README 的链接留了下来）；
                   - 反引号里的仓库内路径指向改名或删除后的位置
                     （`tests/m6/`、`tests/m4a-stream/`、`app/stores/`…）。

                   第三类是**裸文件名**——不带目录，所以上面那条按顶层目录前缀
                   收口的路径检查看不见它。同一次改名（1209651f）删掉的那份
                   playwright.m0-real-backend.config.ts 就是这样漏掉的：
                   tests/fixtures/streams/README.md 里写着「实测数据留在它的注释里」，
                   而那份 config 连同注释一起没了，所有门禁一路全绿。
                   指向 `../` 之外的目标只在那个顶层目录存在时才校验：本模块必须
                   能在仓库其余部分缺席时独立工作。路径检查同样跳过历史区——
                   一条记录说「当时这个文件在 tests/m6/」是既成事实，
                   而不是一条会把人引到不存在目录去的指路。
*/

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * 仓库根 Makefile 的 target。frontend-vue 的文档在讲「起整套服务」时会引用它们，
 * 那不是漂移，是另一层的入口（根 Makefile 管应用生命周期，模块 Makefile 管本模块）。
 *
 * 这张表本身也会被校验：只要 ../Makefile 在 checkout 里，下面每一项都必须真的存在。
 */
const ROOT_MAKE_TARGETS = [
  "dev",
  "dev-vue",
  "dev-dual",
  "docker-start",
  "stop",
];

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".ts",
  ".mts",
  ".mjs",
  ".js",
  ".vue",
  ".sh",
  ".yml",
  ".yaml",
  ".json",
]);

/** 录制下来的 demo 内容不是本仓文档，里面的英文散文不参与检查。 */
const SKIPPED_PREFIXES = ["public/"];

function makeTargets(makefile: string): Set<string> {
  const targets = new Set<string>();
  for (const line of makefile.split("\n")) {
    const match = /^([a-zA-Z0-9_-]+):/.exec(line);
    if (match?.[1]) targets.add(match[1]);
  }
  return targets;
}

/*
  已跟踪 + 未跟踪且未被忽略。只用 `git ls-files` 会让**还没提交的文件对门禁隐形**——
  这条门禁自己就掉进过这个洞：它第一次跑绿，只是因为它自身还没进版本库。
  `48fd6cff` 给 standalone-check 修的是同一个洞。
*/
function trackedTextFiles(): string[] {
  const listed = [
    execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }),
    execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
      cwd: ROOT,
      encoding: "utf8",
    }),
  ].join("\n");
  return listed
    .split("\n")
    .filter((rel) => rel !== "")
    .filter((rel) => !SKIPPED_PREFIXES.some((prefix) => rel.startsWith(prefix)))
    .filter(
      (rel) =>
        TEXT_EXTENSIONS.has(extname(rel)) ||
        rel.split("/").pop() === "Makefile",
    );
}

const HISTORY_BEGIN = "<!-- historical-commands:begin -->";
const HISTORY_END = "<!-- historical-commands:end -->";

/** 把显式圈出的历史区替换成等长空行，保持行号可用于报错定位。 */
function stripHistoricalRegions(source: string): string {
  const lines = source.split("\n");
  let inside = false;
  return lines
    .map((line) => {
      if (line.includes(HISTORY_BEGIN)) {
        inside = true;
        return "";
      }
      if (line.includes(HISTORY_END)) {
        inside = false;
        return "";
      }
      return inside ? "" : line;
    })
    .join("\n");
}

/** 反引号行内代码与围栏代码块里的内容。 */
function codeSpans(source: string): string {
  const fenced = [...source.matchAll(/```[\s\S]*?```/g)].map((m) => m[0]);
  const inline = [...source.matchAll(/`[^`\n]+`/g)].map((m) => m[0]);
  return [...fenced, ...inline].join("\n");
}

const MAKE_CALL = /\bmake\s+([a-zA-Z0-9][a-zA-Z0-9_-]*)/g;

function referencedTargets(source: string) {
  // 每一处都报，不按名字去重：同一个死名字散在五个小节里时，
  // 只报第一处会让人以为改一行就完事了。
  const found: { name: string; line: number }[] = [];
  const stripped = stripHistoricalRegions(source);
  const code = codeSpans(stripped);
  for (const [index, line] of stripped.split("\n").entries()) {
    for (const match of line.matchAll(MAKE_CALL)) {
      const name = match[1] ?? "";
      const looksLikeTarget = name.includes("-");
      const isFormattedAsCommand = code.includes(`make ${name}`);
      if (!looksLikeTarget && !isFormattedAsCommand) continue;
      found.push({ name, line: index + 1 });
    }
  }
  return found;
}

const localTargets = makeTargets(readFileSync(join(ROOT, "Makefile"), "utf8"));

let rootTargets: Set<string> | null = null;
try {
  rootTargets = makeTargets(readFileSync(join(ROOT, "../Makefile"), "utf8"));
} catch {
  // frontend-vue 必须能在没有仓库其余部分时工作；缺席时只跳过根 target 的复核。
  rootTargets = null;
}

/*
  仓库根上由本 fork 维护的文档。它们讲的是「整套服务怎么跑」，位置由职责决定，
  搬不进 frontend-vue/——但此前它们**完全在门禁之外**：这条检查的 root 是
  frontend-vue/，`git ls-files` 也只列这个目录。

  代价是实测出来的：`1209651f` 把 E2E 套件改名后，上一轮只修好了 frontend-vue/
  里的引用，而根 `AGENTS.md` 里的 `e2e-wp10-real-backend`、
  `e2e-wp11-real-backend`、`migration-check`、`e2e-m7` 四个死名字一直躺着，
  照着敲全是 make 的「无此规则」。同一场腐烂，只因为跨了一个目录就漏掉。

  **为什么是显式清单而不是「扫所有根文档」**：实测扫过，上游那些英文文档里
  的 `all` / `simple` / `should-not-trigger` 之类全是普通动词短语被误判，
  会淹没真信号；而且上游文档本来就不该由我们改。

  **清单不会腐烂**，因为下面第一条用例校验它自己：只要仓库其余部分在
  checkout 里，这里每一项都必须真的存在。
*/
const FORK_ROOT_DOCS = [
  "../AGENTS.md",
  "../ENTRY.md",
  "../docs/dual-frontend-production.md",
];

/** 这些文档会引用三层 Makefile 的入口，三层都算数。 */
function backendTargets(): Set<string> {
  try {
    return makeTargets(readFileSync(join(ROOT, "../backend/Makefile"), "utf8"));
  } catch {
    return new Set();
  }
}

const known = new Set([...localTargets, ...ROOT_MAKE_TARGETS]);

function markdownFiles() {
  return trackedTextFiles().filter((rel) => extname(rel) === ".md");
}

/** `[text](target)` 与 `[text](<target>)` 两种写法。 */
const MD_LINK = /\]\(\s*(?:<([^>]+)>|([^)\s]+))\s*\)/g;

/**
 * 反引号里的仓库内路径。限定在这几个顶层目录上，因为文档里也大量写
 * `tasks/custom-event.ts` 这种相对片段（省略了 `app/core/` 前缀），
 * 全量校验会把它们全部误报成不存在。
 */
const REPO_PATH =
  /`((?:frontend-vue\/)?(?:tests|app|server|scripts|packages|config|baseline)\/[A-Za-z0-9_./-]+)`/g;

/**
 * 文档**故意**提到的不存在路径。判据只有一条：这句话的意思就是「它不存在」，
 * 改成存在的路径反而会让文档说谎。加一条就要在这里写清楚为什么。
 */
const DELIBERATELY_ABSENT: Record<string, string> = {
  "packages/agent-ui-kit":
    "REUSE.md 明写「There is deliberately no packages/agent-ui-kit」——围绕耦合的文件做一个包只会藏住耦合。",
  "app/stores/":
    "ARCHITECTURE.md 记录的正是它已经不存在：全仓 defineStore 为 0，而 pinia 仍注册在 nuxt.config.ts 里。",
};

/**
 * 反引号里的**裸文件名**（不带任何目录）。判据只有一条，和 172 号一样：
 * **照着这个名字在 checkout 里搜，什么都搜不到。** 名字还在、只是换了目录不算——
 * 那仍然找得到，而钉住目录会变成随任何一次移动就红的噪声。带目录的路径归
 * REPO_PATH 管，两条互不重叠（这条要求整串里没有 `/`）。
 */
const BARE_FILENAME =
  /`([A-Za-z0-9_][A-Za-z0-9_.-]*\.(?:ts|mts|tsx|mjs|js|cjs|jsx|vue|json|md|yml|yaml|sh|css|py))`/g;

/**
 * 反引号里点名、但整个 checkout 里一个同名文件都没有的名字。
 * 判据同 DELIBERATELY_ABSENT：**这句话的意思本来就不是「仓库里有这个文件」**，
 * 改成一个存在的名字反而会让注释说谎。加一条就要在这里写清楚为什么。
 * 下面第二条用例盯着这张表本身：条目还得真的缺席、也还得真的有人在引它。
 */
const NON_REPO_FILENAMES: Record<string, string> = {
  "Untitled.md":
    "上游导出无标题会话时产出的文件名。那段注释讲的就是本仓导出成了别的名字，不是在指一个仓库文件。",
  "client.js":
    "@hey-api 生成的 SDK 运行时，只存在于 node_modules。那段注释记的是它在 threads.search 里逐字段做了 camelCase → wire 名的转换。",
  "chunk-BO2N2NFS.js":
    "streamdown 发布产物里的 chunk 名。用来说明上游那套 markdown 图标是内联在发布产物里的，不是图标库。",
};

/**
 * 整个 checkout 里出现过的文件名（去掉目录）。必须覆盖兄弟应用与后端：本仓的注释
 * 大量点名上游文件，只按 frontend-vue 自己的清单判会误报几十条（实测 26 条）。
 *
 * 所以这一档**需要完整 checkout**，兄弟应用缺席时直接跳过——与
 * upstream-citations / upstream-zero-claims 同一条规矩，已声明进 standalone-check
 * 的 CROSS_APP_BY_DESIGN。本文件其余的检查（make target、相对链接、仓库内路径）
 * 都不依赖它，照常跑。
 */
const siblingApp = join(ROOT, "../frontend/src");

function checkoutBasenames(): Set<string> | null {
  if (rootTargets === null || !existsSync(siblingApp)) return null;
  const repoRoot = join(ROOT, "..");
  const listed = [
    execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" }),
    execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
      cwd: repoRoot,
      encoding: "utf8",
    }),
  ].join("\n");
  const names = new Set<string>();
  for (const rel of listed.split("\n")) {
    if (rel === "") continue;
    names.add(rel.split("/").pop() as string);
  }
  return names;
}

describe("每条被写进文档的 make 命令都存在", () => {
  it("扫到了文件，也扫到了 Makefile 的 target（两边空掉时不能假绿）", () => {
    expect(localTargets.size).toBeGreaterThan(20);
    expect(trackedTextFiles().length).toBeGreaterThan(50);
  });

  it("声明的仓库根 target 真的在根 Makefile 里", () => {
    if (rootTargets === null) return;
    const missing = ROOT_MAKE_TARGETS.filter(
      (name) => !rootTargets.has(name) && !localTargets.has(name),
    );
    expect(missing).toEqual([]);
  });

  it("没有指向已删除或改名 target 的命令", () => {
    const violations: string[] = [];
    for (const rel of trackedTextFiles()) {
      const source = readFileSync(join(ROOT, rel), "utf8");
      for (const { name, line } of referencedTargets(source)) {
        if (!known.has(name)) violations.push(`${rel}:${line}: make ${name}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("历史区标记成对出现", () => {
    const unbalanced: string[] = [];
    for (const rel of trackedTextFiles()) {
      if (extname(rel) !== ".md") continue;
      const source = readFileSync(join(ROOT, rel), "utf8");
      const begins = source.split(HISTORY_BEGIN).length - 1;
      const ends = source.split(HISTORY_END).length - 1;
      if (begins !== ends)
        unbalanced.push(`${rel}: ${begins} begin / ${ends} end`);
    }
    expect(unbalanced).toEqual([]);
  });
});

/**
 * 真正的测试套件 target。聚合入口和安装/清单类命令不算：它们不对应
 * 一份 playwright config，也不需要在 README 的套件表里各占一行。
 */
const SUITE_INFRASTRUCTURE = new Set([
  "e2e-install",
  "e2e-preflight",
  "e2e-list",
  "e2e-mock",
  "e2e-backend",
]);

describe("套件表和 Makefile 不许分叉", () => {
  const suites = [...localTargets].filter(
    (name) => /^e2e(-|$)/.test(name) && !SUITE_INFRASTRUCTURE.has(name),
  );

  it("认出了全部套件（清单空掉时不能假绿）", () => {
    expect(suites.length).toBeGreaterThan(10);
  });

  /*
    加一个套件却不写进 README，下一个人只能靠读 Makefile 才知道它存在——
    这正是套件改名之后文档整整落后一个版本的起点。
  */
  it.each(["README.md", "README_zh.md"])("%s 列出了每一个套件", (rel) => {
    const source = readFileSync(join(ROOT, rel), "utf8");
    const undocumented = suites.filter(
      (name) => !new RegExp(`make ${name}(?![a-z0-9-])`).test(source),
    );
    expect(undocumented).toEqual([]);
  });

  it("聚合入口的成员和文档一致", () => {
    const makefile = readFileSync(join(ROOT, "Makefile"), "utf8");
    for (const aggregate of ["e2e-mock", "e2e-backend"]) {
      const rule = new RegExp(`^${aggregate}:([^\\n]*)$`, "m").exec(makefile);
      const members = (rule?.[1] ?? "").trim().split(/\s+/).filter(Boolean);
      expect(members.length).toBeGreaterThan(1);
      for (const rel of ["README.md", "README_zh.md"]) {
        const source = readFileSync(join(ROOT, rel), "utf8");
        const missing = members.filter(
          (name) => !source.includes(`\`${name}\``),
        );
        expect({ aggregate, rel, missing }).toEqual({
          aggregate,
          rel,
          missing: [],
        });
      }
    }
  });
});

describe("仓库根上 fork 维护的文档", () => {
  const inFullCheckout = rootTargets !== null;

  it("清单里的每个文件都存在（清单自己不会腐烂）", () => {
    if (!inFullCheckout) return;
    const missing = FORK_ROOT_DOCS.filter(
      (rel) => !existsSync(join(ROOT, rel)),
    );
    expect(
      missing,
      "文件没了就把它从 FORK_ROOT_DOCS 拿掉，别让门禁指向空气",
    ).toEqual([]);
  });

  it("里面每条 make 命令都真的存在", () => {
    if (!inFullCheckout) return;
    const everywhere = new Set([
      ...localTargets,
      ...(rootTargets ?? []),
      ...backendTargets(),
    ]);
    const dead: string[] = [];
    for (const rel of FORK_ROOT_DOCS) {
      const path = join(ROOT, rel);
      if (!existsSync(path)) continue;
      const source = readFileSync(path, "utf8");
      for (const { name, line } of referencedTargets(source)) {
        if (!everywhere.has(name)) dead.push(`${rel}:${line} make ${name}`);
      }
    }
    expect(dead, "照着文档敲会得到 make 的「无此规则」").toEqual([]);
  });
});

describe("文档指名的文件都存在", () => {
  it("Markdown 相对链接可以解析", () => {
    const violations: string[] = [];
    for (const rel of markdownFiles()) {
      const dir = join(ROOT, rel, "..");
      const source = readFileSync(join(ROOT, rel), "utf8");
      for (const [index, line] of source.split("\n").entries()) {
        for (const match of line.matchAll(MD_LINK)) {
          const raw = match[1] ?? match[2] ?? "";
          const target = raw.split("#")[0] ?? "";
          if (target === "") continue;
          if (/^(?:https?:|mailto:|#)/.test(target)) continue;
          const resolved = join(dir, target);
          if (target.startsWith("../")) {
            // 模块外的目标只在那一层真的在 checkout 里时才校验。
            const top = join(dir, target.split("/").slice(0, 2).join("/"));
            if (!existsSync(top)) continue;
          }
          if (!existsSync(resolved)) {
            violations.push(`${rel}:${index + 1}: ${target}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("反引号里的仓库内路径可以解析", () => {
    const violations: string[] = [];
    for (const rel of markdownFiles()) {
      const source = stripHistoricalRegions(
        readFileSync(join(ROOT, rel), "utf8"),
      );
      for (const [index, line] of source.split("\n").entries()) {
        for (const match of line.matchAll(REPO_PATH)) {
          const target = (match[1] ?? "").replace(/^frontend-vue\//, "");
          if (target.includes("*")) continue;
          if (target in DELIBERATELY_ABSENT) continue;
          if (!existsSync(join(ROOT, target))) {
            violations.push(`${rel}:${index + 1}: ${target}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  /*
    这一条扫的是全部文本文件，不只是 Markdown：死掉的文件名躺在源码文件头注释里
    和躺在文档里烂得一样彻底，而注释正是本仓写「为什么这么做」的地方。
  */
  it("反引号里的裸文件名在 checkout 里搜得到", () => {
    const known = checkoutBasenames();
    if (known === null) return;
    const violations: string[] = [];
    let scanned = 0;
    for (const rel of trackedTextFiles()) {
      const source = stripHistoricalRegions(
        readFileSync(join(ROOT, rel), "utf8"),
      );
      for (const [index, line] of source.split("\n").entries()) {
        for (const match of line.matchAll(BARE_FILENAME)) {
          const name = match[1] ?? "";
          scanned += 1;
          if (known.has(name)) continue;
          if (name in NON_REPO_FILENAMES) continue;
          violations.push(`${rel}:${index + 1}: ${name}`);
        }
      }
    }
    // 正则写坏时主断言会静默全绿——空集合永远 toEqual([])（同 131 号）。
    expect(scanned).toBeGreaterThan(100);
    expect(
      violations,
      "照着这个名字在整个 checkout 里搜，一个文件都搜不到",
    ).toEqual([]);
  });

  it("豁免名单自己不会腐烂：每一条都还缺席、也还有人在引", () => {
    const known = checkoutBasenames();
    if (known === null) return;
    const cited = new Set<string>();
    for (const rel of trackedTextFiles()) {
      const source = stripHistoricalRegions(
        readFileSync(join(ROOT, rel), "utf8"),
      );
      for (const match of source.matchAll(BARE_FILENAME)) {
        cited.add(match[1] ?? "");
      }
    }
    const stale = Object.keys(NON_REPO_FILENAMES).filter(
      (name) => known.has(name) || !cited.has(name),
    );
    expect(
      stale,
      "文件出现了、或者没人再引它——把这一条从 NON_REPO_FILENAMES 拿掉",
    ).toEqual([]);
  });
});
