#!/usr/bin/env node
/*
  【文件职责】     把 manifest 判定为 RETYPED 的文件按声明的改写落到 app/core/，并生成台账行。
  【对应 frontend/】 frontend/src/core/**（只读，源在 baseline commit 上）
  【架构位置】     构建脚本
  【主要导出】     CLI：--write 落地；默认 --check 校验落地物没被手改
  【依赖关系】     baseline/core-manifest.json；写 app/core/** 与 app/core/PROVENANCE.md
  【边界与注意】   与 land-copied.mjs 的分工：那边是**按字节复制**，这边是**按声明改写**。
                   RETYPED 是我们改过的代码，因此要加六段式文件头、要过 prettier、
                   要受 eslint 检查——都与 COPIED 相反。

                   改写只有两种来源，别的一律报错退出：
                     1. IMPORT_REWRITES —— specifier 机械重定向（AST 定位，按字节区间替换）。
                        24 个里 17 个只需要这一步。
                     2. PATCHES —— 语义改写，逐条手写 find/replace 并附理由。
                        每条 find 必须**恰好命中一次**，命中 0 次或多次直接报错：
                        上游一改，声明就过期，这时候要红，不能悄悄少改一处。

                   末尾还有一道残留检查：改写掉的 specifier 不许再出现在产物里。
                   codemod 那边正是靠同款兜底拦住了漏改的 `ReturnType<typeof rs.fn>`。

                   --check 的意义与 codemod-check 相同：**RETYPED 落地物也不许手改**。
                   真需要针对 Vue 侧改，它就不再是「上游 + 声明」推出来的，
                   登记进 HAND_MAINTAINED 并写明理由。
*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import prettier from "prettier";

import {
  readBaselineFile,
  resolveCommit,
  sha256,
} from "./lib/source-facts.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LEDGER = join(ROOT, "app/core/PROVENANCE.md");
const BEGIN = "<!-- RETYPED:BEGIN 由 `make land-retyped` 生成，勿手改 -->";
const END = "<!-- RETYPED:END -->";

/**
 * specifier 机械重定向。口径必须与 core-provenance.mjs 的 SPECIFIER_REWRITES 一致：
 * 那边决定「这个文件是 RETYPED」，这边决定「具体改成什么」，对不上就会出现
 * 分类说要改、落地却没改的洞。哪些包不装、值导入怎么处理，见 core-provenance.mjs 的 REMOVED_DEPS。
 */
const IMPORT_REWRITES = [
  {
    match: /^@langchain\/(langgraph-sdk|core)(\/.*)?$/,
    to: "@/core/types/message",
  },
  { match: /^lucide-react$/, to: "lucide-vue-next" },
  {
    match: /^@\/components\/workspace\/scheduled-task-schedule-input$/,
    to: "./schedule",
  },
];

/**
 * 语义改写。每条都是「上游这段 → 我们这段」，附上为什么。
 * 只有 7 个文件需要，其余 17 个纯靠 IMPORT_REWRITES。
 */
const PATCHES = {
  // --- 删 static-mode 分支（01-scope 已排除静态模式，06 §M1 1b「删分支」） ---
  "artifacts/utils.ts": [
    {
      why: "isStaticWebsiteOnly 早返回随 static-mode 一起删；下同。",
      find: `  if (isStaticWebsiteOnly()) {
    return staticDemoArtifactURL({ filepath, threadId, download });
  }
  const encodedThreadId`,
      replace: `  const encodedThreadId`,
    },
    {
      why: "第二处早返回。",
      find: `  if (isStaticWebsiteOnly()) {
    return staticDemoArtifactURL({ filepath: absolutePath, threadId });
  }
  return \`\${getBackendBaseURL()}/api/threads/`,
      replace: `  return \`\${getBackendBaseURL()}/api/threads/`,
    },
    {
      why: "两处早返回删完后 staticDemoArtifactURL 再无消费方，留着 eslint 会报 no-unused-vars。",
      find: `
function staticDemoArtifactURL({
  filepath,
  threadId,
  download = false,
}: {
  filepath: string;
  threadId: string;
  download?: boolean;
}) {
  const demoPath = encodeArtifactPath(filepath.replace(/^\\/mnt\\//, "/"));
  return \`\${getBackendBaseURL()}/demo/threads/\${encodeURIComponent(threadId)}\${demoPath}\${download ? "?download=true" : ""}\`;
}
`,
      replace: "",
    },
  ],
  "models/api.ts": [
    {
      why: "早返回与它唯一的消费对象 STATIC_MODELS_RESPONSE 一起删。",
      find: `const STATIC_MODELS_RESPONSE: ModelsResponse = {
  models: [],
  token_usage: { enabled: false },
};

export async function loadModels(): Promise<ModelsResponse> {
  if (isStaticWebsiteOnly()) {
    return STATIC_MODELS_RESPONSE;
  }

  const res`,
      replace: `export async function loadModels(): Promise<ModelsResponse> {
  const res`,
    },
  ],
  // --- runtime options（06 §M1 1a、08 §Runtime config 与认证边界） ---
  "config/index.ts": [
    {
      why: [
        "@/env 是 Next 的编译期环境变量对象，Nuxt 侧没有。08 要求纯 core 不调 useRuntimeConfig()，",
        "改为在模块级持有一份注入的普通对象。",
        "为什么是模块级持有而不是把 options 加进函数签名：getBackendBaseURL() 的调用方",
        "（artifacts/utils.ts、models/api.ts、uploads/api.ts …）全是 COPIED 档，",
        "改签名就得改它们，hash 护城河当场作废。注入点是 Nuxt plugin，不是 core。",
      ].join(" "),
      find: `import { env } from "@/env";

function getBaseOrigin() {`,
      replace: `/**
 * Nuxt plugin 在应用启动时读 runtime config，构造这个纯对象后注入。
 * core 自己不认识 Nuxt，也不读 cookie / process.env。
 */
export interface DeerFlowRuntimeOptions {
  langgraphBaseUrl: string;
  backendBaseUrl: string;
  authDisabled: boolean;
}

const DEFAULT_RUNTIME_OPTIONS: DeerFlowRuntimeOptions = {
  langgraphBaseUrl: "",
  backendBaseUrl: "",
  authDisabled: false,
};

let runtimeOptions: DeerFlowRuntimeOptions = DEFAULT_RUNTIME_OPTIONS;

export function setDeerFlowRuntimeOptions(options: DeerFlowRuntimeOptions) {
  runtimeOptions = options;
}

export function getDeerFlowRuntimeOptions(): DeerFlowRuntimeOptions {
  return runtimeOptions;
}

/** 测试与 HMR 用：回到「什么都没注入」的初始态。 */
export function resetDeerFlowRuntimeOptions() {
  runtimeOptions = DEFAULT_RUNTIME_OPTIONS;
}

function getBaseOrigin() {`,
    },
    {
      why: "两个 env 读取点改成读注入值；空串 → 落回原分支，与上游 env 未设置时行为一致。",
      find: `  if (env.NEXT_PUBLIC_BACKEND_BASE_URL) {
    return new URL(env.NEXT_PUBLIC_BACKEND_BASE_URL, getBaseOrigin())`,
      replace: `  if (runtimeOptions.backendBaseUrl) {
    return new URL(runtimeOptions.backendBaseUrl, getBaseOrigin())`,
    },
    {
      why: "同上，LangGraph 侧。",
      find: `  if (env.NEXT_PUBLIC_LANGGRAPH_BASE_URL) {
    return new URL(
      env.NEXT_PUBLIC_LANGGRAPH_BASE_URL,
      getBaseOrigin(),
    ).toString();`,
      replace: `  if (runtimeOptions.langgraphBaseUrl) {
    return new URL(runtimeOptions.langgraphBaseUrl, getBaseOrigin()).toString();`,
    },
  ],
  // --- 严格度差异（见文件头「noImplicitAny」一节） ---
  "messages/utils.ts": [
    {
      why: [
        "自写的 AgentContentPart 按 08 是开放形状，image_url 可选；",
        "SDK 的闭合联合里 image_url 是必填，所以上游这里不用收敛。",
        'switch 已经落在 case "image_url" 上，运行时必然存在，用 ! 收敛，不改行为。',
      ].join(" "),
      find: `            const imageURL = extractURLFromImageURLContent(content.image_url);`,
      replace: `            const imageURL = extractURLFromImageURLContent(
              content.image_url!,
            );`,
    },
    {
      why: [
        "上游 `let fileMatch;` 在 noImplicitAny:false 下是隐式 any，索引访问不受检；",
        "frontend-vue 继承 strict 的 noImplicitAny:true，同一行就变成",
        "RegExpExecArray 索引 + noUncheckedIndexedAccess。正则的 3 个捕获组都是必得的，",
        "用 ! 收敛。纯类型断言，编译后一个字节都不变。",
      ].join(" "),
      find: `      filename: fileMatch[1].trim(),
      size: parseHumanReadableSize(fileMatch[2]),
      path: fileMatch[3].trim(),`,
      replace: `      filename: fileMatch[1]!.trim(),
      size: parseHumanReadableSize(fileMatch[2]!),
      path: fileMatch[3]!.trim(),`,
    },
  ],

  "auth/auth-disabled-user.ts": [
    {
      why: [
        "Nuxt 客户端产物没有 process.env（06 §M1 1a 点名的两个之一）。",
        "改为读 config/index.ts 注入的 authDisabled。",
        "上游那条「显式 production 环境则强制关掉」的兜底在这里没有等价输入——",
        "Nuxt 的 runtime config 由部署方给，注入 authDisabled=true 本身就是部署方的决定。",
        "因此这条兜底不再存在，属于**行为变更**，已在 evidence 里点名。",
      ].join(" "),
      find: `const PRODUCTION_ENV_VALUES = new Set(["prod", "production"]);

function isExplicitProductionEnvironment() {
  return ["DEER_FLOW_ENV", "ENVIRONMENT"].some((name) =>
    PRODUCTION_ENV_VALUES.has((process.env[name] ?? "").trim().toLowerCase()),
  );
}

export function isAuthDisabledMode() {
  return (
    process.env.DEER_FLOW_AUTH_DISABLED === "1" &&
    !isExplicitProductionEnvironment()
  );
}`,
      replace: `export function isAuthDisabledMode() {
  return getDeerFlowRuntimeOptions().authDisabled;
}`,
    },
    {
      why: "补上 runtime options 的导入。",
      find: `import type { User } from "./types";`,
      replace: `import { getDeerFlowRuntimeOptions } from "../config";

import type { User } from "./types";`,
    },
  ],
};

/**
 * 落地物一律不许手改（--check 会红）。确实需要针对 Vue 侧改写时，
 * 它就不再是「上游 + 声明」推出来的：登记到这里并写明理由，本脚本从此不碰它。
 * 目前为空。
 */
const HAND_MAINTAINED = {};

/** 六段式文件头（04 §6）。COPIED 档不加（04 已裁决），RETYPED 是我们的代码，必须加。 */
const HEADERS = {
  __default__: {
    位置: "L3",
  },
};

// ---------------------------------------------------------------------------
// 改写
// ---------------------------------------------------------------------------

function findRewrite(specifier) {
  return IMPORT_REWRITES.find((rule) => rule.match.test(specifier));
}

/** 收集 import 改写与整条删除的字节区间。 */
function collectImportEdits(sourceFile, dropped) {
  const edits = [];
  const rewritten = new Set();
  const droppedHit = new Set();
  /** 改写目标 → 已经指向它的第一条 import。用于合并重定向后撞车的两条。 */
  const firstByTarget = new Map();

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const specifier = statement.moduleSpecifier.text;

    if (dropped.includes(specifier)) {
      droppedHit.add(specifier);
      // 连同行尾换行一起删，避免留下空行让 prettier 与 --check 对不上。
      edits.push({
        start: statement.getStart(sourceFile),
        end: Math.min(statement.end + 1, sourceFile.text.length),
        text: "",
      });
      continue;
    }

    const rule = findRewrite(specifier);
    if (!rule) continue;
    rewritten.add(specifier);

    // 两个不同的上游 specifier 可能重定向到同一个目标（tools/utils.ts 就是：
    // @langchain/core/messages 与 @langchain/langgraph-sdk 都指向 @/core/types/message）。
    // 不合并的话产物里会有两条同源 import，eslint 的 import/no-duplicates 直接红。
    const previous = firstByTarget.get(rule.to);
    if (previous) {
      edits.push({
        start: previous.insertAt,
        end: previous.insertAt,
        text: `, ${namedBindingsText(statement, sourceFile)}`,
      });
      edits.push({
        start: statement.getStart(sourceFile),
        end: Math.min(statement.end + 1, sourceFile.text.length),
        text: "",
      });
      continue;
    }

    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      firstByTarget.set(rule.to, {
        insertAt: bindings.elements[bindings.elements.length - 1].end,
      });
    }
    edits.push({
      start: statement.moduleSpecifier.getStart(sourceFile),
      end: statement.moduleSpecifier.end,
      text: JSON.stringify(rule.to),
    });
  }

  const missed = dropped.filter((specifier) => !droppedHit.has(specifier));
  if (missed.length) {
    throw new Error(
      `声明要删的 import 在源码里找不到：${missed.join("、")}。RETYPE_DROPS 已过期。`,
    );
  }
  return { edits, rewritten };
}

/** `import type { A, B } from "x"` → `A, B`（合并到另一条 import 时用）。 */
function namedBindingsText(statement, sourceFile) {
  const bindings = statement.importClause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) {
    throw new Error(
      `${sourceFile.fileName}: 只能合并具名 import，遇到了别的形式。`,
    );
  }
  return bindings.elements
    .map((element) => element.getText(sourceFile))
    .join(", ");
}

function applyEdits(text, edits) {
  let out = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}

/** 从 `function name(` 起删到与之配对的右花括号（含）。用于删掉整个已无消费方的函数。 */
function dropFunctionAt(text, signature) {
  const start = text.indexOf(signature);
  if (start === -1) throw new Error(`找不到要删的函数：${signature}`);
  let depth = 0;
  let index = text.indexOf("{", start);
  if (index === -1) throw new Error(`函数没有函数体：${signature}`);
  for (; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) throw new Error(`函数花括号不配对：${signature}`);
  return text.slice(0, start) + text.slice(index + 1);
}

function applyPatches(text, patches, source) {
  let out = text;
  for (const patch of patches) {
    if (patch.replace === "__DROP_FUNCTION__") {
      out = dropFunctionAt(out, patch.find);
      continue;
    }
    const hits = out.split(patch.find).length - 1;
    if (hits !== 1) {
      throw new Error(
        `${source}: 补丁命中 ${hits} 次（应为 1 次），声明已过期。理由：${patch.why}\n` +
          `--- find ---\n${patch.find}`,
      );
    }
    out = out.replace(patch.find, () => patch.replace);
  }
  return out;
}

function header(entry, sourceRoot, exportsLine) {
  const reasons = entry.reasons.map((reason) => reason.detail).join("");
  return `/*
  【文件职责】     见下方源码；本文件由 ${sourceRoot}/${entry.source} retype 而来。
  【对应 frontend/】 ${sourceRoot}/${entry.source}
  【架构位置】     ${HEADERS[entry.source]?.位置 ?? HEADERS.__default__.位置}
  【主要导出】     ${exportsLine || "见源码"}
  【依赖关系】     见下方 import；改写清单由 scripts/land-retyped.mjs 声明
  【边界与注意】   RETYPED：内容**不是**上游逐字节等同，因此不参与 COPIED hash 护城河。
                   相对上游的改动只有这些：${reasons}
                   勿手改——\`make land-retyped-check\` 会红；确需手改就登记进
                   land-retyped.mjs 的 HAND_MAINTAINED 并写明理由。
*/

`;
}

/** 只取顶层 export 名字，用于填文件头的「主要导出」。 */
function exportedNames(sourceFile) {
  const names = [];
  for (const statement of sourceFile.statements) {
    const isExported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!isExported) continue;
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name))
          names.push(declaration.name.text);
      }
    } else if (statement.name && ts.isIdentifier(statement.name)) {
      names.push(statement.name.text);
    }
  }
  return names.length > 6
    ? `${names.slice(0, 6).join(" / ")} 等 ${names.length} 个`
    : names.join(" / ");
}

async function transform(entry, sourceRoot, commit) {
  const path = `${sourceRoot}/${entry.source}`;
  const buffer = readBaselineFile(commit, path);
  const actual = sha256(buffer);
  if (actual !== entry.sha256) {
    throw new Error(
      `${entry.source}: 从 ${commit.slice(0, 8)} 读到的内容与 manifest 记录不符。`,
    );
  }

  const text = buffer.toString("utf8");
  const sourceFile = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  const dropped = entry.droppedImports ?? [];
  const { edits, rewritten } = collectImportEdits(sourceFile, dropped);
  let out = applyEdits(text, edits);
  out = applyPatches(out, PATCHES[entry.source] ?? [], entry.source);

  // 分类说要改、落地却什么都没改 —— 这种洞必须当场报出来。
  if (!rewritten.size && !dropped.length && !PATCHES[entry.source]) {
    throw new Error(
      `${entry.source}: 被判为 RETYPED 但没有任何声明的改写。` +
        "要么补 IMPORT_REWRITES/PATCHES，要么它根本不该是 RETYPED。",
    );
  }

  const withHeader = header(entry, sourceRoot, exportedNames(sourceFile)) + out;
  const formatted = await prettier.format(withHeader, {
    ...(await prettier.resolveConfig(join(ROOT, "package.json"))),
    parser: "typescript",
  });

  // 兜底：改写掉与删掉的 specifier 都不许再出现。
  const body = formatted.replace(/^\/\*[\s\S]*?\*\/\n\n/, "");
  for (const specifier of [...rewritten, ...dropped]) {
    if (body.includes(`"${specifier}"`)) {
      throw new Error(`${entry.source}: 改写后仍残留 "${specifier}"。`);
    }
  }
  return formatted;
}

// ---------------------------------------------------------------------------
// 台账
// ---------------------------------------------------------------------------

const cell = (text) => text.replace(/\|/g, "\\|");

function renderBlock(entries) {
  const rows = entries.map((entry) => {
    const detail = entry.reasons.map((reason) => reason.detail).join(" ");
    return `| \`${entry.source}\` | \`RETYPED\` | \`${entry.source}\` | ${cell(detail)} |`;
  });
  return [BEGIN, ...rows, END].join("\n");
}

function spliceBlock(markdown, block) {
  const start = markdown.indexOf(BEGIN);
  const end = markdown.indexOf(END);
  if (start !== -1 && end !== -1) {
    return markdown.slice(0, start) + block + markdown.slice(end + END.length);
  }
  // 首次落地：插在 COPIED 块**之后**，与它并列而不是嵌进去。
  const copiedEnd = markdown.indexOf("<!-- COPIED:END -->");
  if (copiedEnd === -1) throw new Error("PROVENANCE.md 里找不到 COPIED 块。");
  const at = copiedEnd + "<!-- COPIED:END -->".length;
  return `${markdown.slice(0, at)}\n\n${block}${markdown.slice(at)}`;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  const write = process.argv.slice(2).includes("--write");
  const manifest = JSON.parse(
    readFileSync(join(ROOT, "baseline/core-manifest.json"), "utf8"),
  );
  const commit = resolveCommit(manifest.baselineCommit);
  const retyped = manifest.files
    .filter((entry) => entry.class === "RETYPED")
    .filter((entry) => !HAND_MAINTAINED[entry.source])
    .sort((a, b) => a.source.localeCompare(b.source));

  const generated = new Map();
  for (const entry of retyped) {
    generated.set(
      `app/core/${entry.source}`,
      await transform(entry, manifest.sourceRoot, commit),
    );
  }

  if (write) {
    for (const [rel, content] of generated) {
      mkdirSync(dirname(join(ROOT, rel)), { recursive: true });
      writeFileSync(join(ROOT, rel), content);
    }
    const ledger = spliceBlock(
      readFileSync(LEDGER, "utf8"),
      renderBlock(retyped),
    );
    writeFileSync(
      LEDGER,
      await prettier.format(ledger, {
        ...(await prettier.resolveConfig(LEDGER)),
        parser: "markdown",
      }),
    );
    process.stdout.write(
      `${generated.size} 个 RETYPED 已落到 app/core/（基线 ${commit.slice(0, 8)}）\n`,
    );
    return;
  }

  let drift = false;
  for (const [rel, expected] of generated) {
    let actual = null;
    try {
      actual = readFileSync(join(ROOT, rel), "utf8");
    } catch {
      /* 缺文件按漂移处理 */
    }
    if (actual !== expected) {
      drift = true;
      process.stderr.write(`与声明的改写不一致：${rel}\n`);
    }
  }
  if (drift) {
    process.stderr.write(
      "运行 `make land-retyped` 重建。若这处改动是有意的，它就不再是声明推出来的：" +
        "登记进 land-retyped.mjs 的 HAND_MAINTAINED。\n",
    );
    process.exit(1);
  }
  process.stdout.write(`${generated.size} 个 RETYPED 与声明的改写一致\n`);
}

await main();
