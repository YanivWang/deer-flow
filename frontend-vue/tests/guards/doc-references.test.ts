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
});
