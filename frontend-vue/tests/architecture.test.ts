/*
  【文件职责】     守护 agent-core 的 L1 禁入边界（08 §L1 禁入清单的全部 7 条）。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     扫描 packages/agent-core/src
  【边界与注意】   禁止通过改测试放宽 L1 边界。

                   M0 版只查了 import specifier，也就是 7 条里的第 4 条和半条第 7 条。
                   其余 5 条（endpoint、LangGraph 名称、DeerFlow 业务词、cookie/token
                   读取、全局单例）当时没查——`src/` 只有一个 10 行的 stub，查不查都绿。
                   **现在补齐正是因为 M2 马上要往这个目录里写东西**：
                   边界靠的是「越界当场红」，等目录满了再补，越界的代码已经进来了。

                   注意第 1 条与第 3 条只能按**词**匹配，不能按子串：L1 合法地存在
                   `values` 之外的 `getValues`、业务词之外的 `stateKey`。
                   按子串匹配会制造误报，而误报会让人去改测试——那正是这条注释开头
                   禁止的事。
*/

import { readdirSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = new URL("../packages/agent-core/src/", import.meta.url);

/** 第 4 条 + 第 7 条：框架运行时依赖，以及反向 import。 */
const forbiddenImports = [
  /^vue(?:\/|$)/,
  /^@vue\//,
  /^nuxt(?:\/|$)/,
  /^#(?:app|imports)/,
  /^pinia(?:\/|$)/,
  /^react(?:\/|$)/,
  /^react-dom(?:\/|$)/,
  /^@langchain\//,
  /^ai(?:\/|$)/,
  /^@\/components(?:\/|$)/,
  /^@\/core(?:\/|$)/,
  /(?:^|\/)frontend\//,
  /(?:^|\/)app\/core\//,
];

/** 第 1 条：具体 endpoint 或 `/api/` 路径。L1 不认识 URL。 */
const forbiddenPaths = [/\/api\//, /\/api['"`]/];

/**
 * 第 2 条：LangGraph 名称。第 3 条：DeerFlow 业务词。
 * 都按整词匹配（见文件头）。
 */
const forbiddenWords = [
  // LangGraph
  "messages-tuple",
  "checkpoints",
  "langgraph",
  "assistant_id",
  "thread_id",
  // DeerFlow 业务
  "artifact",
  "artifacts",
  "skill",
  "skills",
  "subagent",
  "browserView",
  "browser-view",
];

/** 第 5 条：cookie / token / runtime config 的读取。 */
const forbiddenReads = [
  /\bdocument\s*\.\s*cookie\b/,
  /\buseRuntimeConfig\b/,
  /\bprocess\s*\.\s*env\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
];

function sourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(
      `${entry.name}${entry.isDirectory() ? "/" : ""}`,
      directory,
    );
    return entry.isDirectory()
      ? sourceFiles(child)
      : extname(entry.name) === ".ts"
        ? [child]
        : [];
  });
}

/** 应用侧源码（相对仓库根的路径），用于反方向的深路径 import 检查。 */
function appSourceFiles(relRoot: string): string[] {
  const root = new URL(`../${relRoot}/`, import.meta.url);
  const found: string[] = [];
  const walk = (directory: URL, prefix: string) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`);
      } else if ([".ts", ".vue"].includes(extname(entry.name))) {
        found.push(`${prefix}${entry.name}`);
      }
    }
  };
  walk(root, `${relRoot}/`);
  return found;
}

/** 注释里出现业务词是允许的——禁的是代码认识它们，不是文档提到它们。 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const files = sourceFiles(sourceRoot).map((file) => {
  const raw = readFileSync(file, "utf8");
  return {
    name: file.pathname.split("/agent-core/").pop() ?? file.pathname,
    raw,
    code: stripComments(raw),
  };
});

describe("agent-core 的 L1 禁入清单（08）", () => {
  it("扫到了源文件（目录空掉时不能假绿）", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("没有宿主框架依赖，也没有反向 import", () => {
    const violations: string[] = [];
    for (const file of files) {
      for (const match of file.code.matchAll(
        /(?:from\s+|import\s*)["']([^"']+)["']/g,
      )) {
        const specifier = match[1] ?? "";
        if (forbiddenImports.some((pattern) => pattern.test(specifier))) {
          violations.push(`${file.name}: ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("没有具体 endpoint 或 /api/ 路径", () => {
    const violations = files
      .filter((file) => forbiddenPaths.some((p) => p.test(file.code)))
      .map((file) => file.name);
    expect(violations).toEqual([]);
  });

  it("没有 LangGraph 名称与 DeerFlow 业务词", () => {
    const violations: string[] = [];
    for (const file of files) {
      for (const word of forbiddenWords) {
        // 整词：两侧不能再接标识符字符，否则 getValues / stateKey 会被误伤。
        const pattern = new RegExp(
          `(?<![\\w$])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w$])`,
          "i",
        );
        if (pattern.test(file.code)) violations.push(`${file.name}: ${word}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("不读 cookie / token / runtime config", () => {
    const violations: string[] = [];
    for (const file of files) {
      for (const pattern of forbiddenReads) {
        if (pattern.test(file.code)) {
          violations.push(`${file.name}: ${pattern.source}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("应用侧不深路径 import agent-core（08 §包与 workspace 契约）", () => {
    // 反方向的那一条：L1 只能通过 `@deerflow/agent-core` 的公共导出面被消费。
    // 深路径 import 会绕过 src/index.ts，让「整包搬走」这个卖点当场作废——
    // 消费方拿到包之后发现自己依赖的是没导出的内部路径。
    // 目前应用侧一处都没有（M2 才开始接线），趁还是零的时候把门关上。
    const violations: string[] = [];
    for (const root of ["app", "tests/unit", "server"]) {
      for (const rel of appSourceFiles(root)) {
        const absolute = fileURLToPath(new URL(`../${rel}`, import.meta.url));
        const code = stripComments(readFileSync(absolute, "utf8"));
        for (const match of code.matchAll(
          /(?:from\s+|import\s*)["']([^"']+)["']/g,
        )) {
          const specifier = match[1] ?? "";
          if (/agent-core\/src(?:\/|$)/.test(specifier)) {
            violations.push(`${rel}: ${specifier}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("没有全局单例（模块级可变状态）", () => {
    // 模块顶层的 `let` / `var` 就是单例的形状：整个包共享一份，
    // 多 thread / 多 sidecar session 会互相串状态。L1 的实例必须由工厂函数创建。
    const violations: string[] = [];
    for (const file of files) {
      for (const line of file.code.split("\n")) {
        if (/^(?:export\s+)?(?:let|var)\s/.test(line)) {
          violations.push(`${file.name}: ${line.trim()}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

const l2Files = [
  "app/lib/utils.ts",
  "app/core/markdown/animate.ts",
  "app/core/markdown/blocks.ts",
  "app/core/markdown/index.ts",
  "app/core/markdown/mermaid-export.ts",
  "app/core/markdown/pipeline.ts",
  "app/core/markdown/plugins.ts",
  "app/core/markdown/render.ts",
  "app/core/markdown/rendering-context.ts",
  "app/core/markdown/safe-markdown.ts",
  "app/components/markdown/CodeBlock.vue",
  "app/components/markdown/MarkdownBlock.vue",
  "app/components/markdown/MarkdownCopyButton.vue",
  "app/components/markdown/MarkdownIcon.vue",
  "app/components/markdown/MarkdownPre.vue",
  "app/components/markdown/MermaidChart.vue",
  "app/components/markdown/MermaidDiagram.vue",
  "app/components/markdown/MermaidDownloadMenu.vue",
  "app/components/markdown/MermaidFullscreen.vue",
  "app/components/markdown/MermaidZoomPan.vue",
  "app/components/markdown/StreamMarkdown.vue",
  "app/components/markdown/components.ts",
  "app/components/ui/button/Button.vue",
  "app/components/ui/button/index.ts",
  "app/components/ui/button/variants.ts",
  "app/components/ui/sidebar/SidebarTrigger.vue",
  "app/components/ui/sidebar/index.ts",
  "app/lib/focusable.ts",
  "app/components/ui/alert-dialog/AlertDialog.vue",
  "app/components/ui/alert-dialog/AlertDialogAction.vue",
  "app/components/ui/alert-dialog/AlertDialogCancel.vue",
  "app/components/ui/alert-dialog/AlertDialogContent.vue",
  "app/components/ui/alert-dialog/AlertDialogDescription.vue",
  "app/components/ui/alert-dialog/AlertDialogFooter.vue",
  "app/components/ui/alert-dialog/AlertDialogHeader.vue",
  "app/components/ui/alert-dialog/AlertDialogTitle.vue",
  "app/components/ui/alert-dialog/AlertDialogTrigger.vue",
  "app/components/ui/alert-dialog/index.ts",
  "app/core/code-editor/editor.ts",
  "app/core/code-editor/language.ts",
  "app/core/code-editor/palette.ts",
  "app/components/ui/chain-of-thought/ChainOfThought.vue",
  "app/components/ui/chain-of-thought/ChainOfThoughtContent.vue",
  "app/components/ui/chain-of-thought/ChainOfThoughtStep.vue",
  "app/components/ui/chain-of-thought/context.ts",
  "app/components/ui/chain-of-thought/index.ts",
  "app/components/ui/code-editor/CodeEditor.vue",
  "app/components/ui/code-editor/index.ts",
  "app/components/ui/collapsible/Collapsible.vue",
  "app/components/ui/collapsible/CollapsibleContent.vue",
  "app/components/ui/collapsible/CollapsibleTrigger.vue",
  "app/components/ui/collapsible/index.ts",
  "app/components/ui/reasoning/Reasoning.vue",
  "app/components/ui/reasoning/ReasoningContent.vue",
  "app/components/ui/reasoning/ReasoningTrigger.vue",
  "app/components/ui/reasoning/context.ts",
  "app/components/ui/reasoning/index.ts",
  "app/components/ui/command/Command.vue",
  "app/components/ui/command/CommandEmpty.vue",
  "app/components/ui/command/CommandInput.vue",
  "app/components/ui/command/CommandItem.vue",
  "app/components/ui/command/CommandList.vue",
  "app/components/ui/command/CommandShortcut.vue",
  "app/components/ui/command/index.ts",
  "app/components/ui/conversation/ConversationEmptyState.vue",
  "app/components/ui/conversation/index.ts",
  "app/components/ui/dialog/Dialog.vue",
  "app/components/ui/dialog/DialogClose.vue",
  "app/components/ui/dialog/DialogContent.vue",
  "app/components/ui/dialog/DialogDescription.vue",
  "app/components/ui/dialog/DialogFooter.vue",
  "app/components/ui/dialog/DialogHeader.vue",
  "app/components/ui/dialog/DialogOverlay.vue",
  "app/components/ui/dialog/DialogTitle.vue",
  "app/components/ui/dialog/DialogTrigger.vue",
  "app/components/ui/dialog/index.ts",
  "app/components/ui/dropdown-menu/DropdownMenu.vue",
  "app/components/ui/dropdown-menu/DropdownMenuContent.vue",
  "app/components/ui/dropdown-menu/DropdownMenuItem.vue",
  "app/components/ui/dropdown-menu/DropdownMenuLabel.vue",
  "app/components/ui/dropdown-menu/DropdownMenuRadioGroup.vue",
  "app/components/ui/dropdown-menu/DropdownMenuRadioItem.vue",
  "app/components/ui/dropdown-menu/DropdownMenuSeparator.vue",
  "app/components/ui/dropdown-menu/DropdownMenuTrigger.vue",
  "app/components/ui/dropdown-menu/index.ts",
  "app/components/ui/hover-card/HoverCard.vue",
  "app/components/ui/hover-card/HoverCardContent.vue",
  "app/components/ui/hover-card/HoverCardTrigger.vue",
  "app/components/ui/hover-card/index.ts",
  "app/components/ui/popover/Popover.vue",
  "app/components/ui/popover/PopoverAnchor.vue",
  "app/components/ui/popover/PopoverContent.vue",
  "app/components/ui/popover/PopoverTrigger.vue",
  "app/components/ui/popover/index.ts",
  "app/components/ui/scroll-area/ScrollArea.vue",
  "app/components/ui/scroll-area/index.ts",
  "app/components/ui/select/Select.vue",
  "app/components/ui/select/SelectContent.vue",
  "app/components/ui/select/SelectItem.vue",
  "app/components/ui/select/SelectTrigger.vue",
  "app/components/ui/select/SelectValue.vue",
  "app/components/ui/select/index.ts",
  "app/components/ui/sheet/Sheet.vue",
  "app/components/ui/sheet/SheetClose.vue",
  "app/components/ui/sheet/SheetContent.vue",
  "app/components/ui/sheet/SheetDescription.vue",
  "app/components/ui/sheet/SheetFooter.vue",
  "app/components/ui/sheet/SheetHeader.vue",
  "app/components/ui/sheet/SheetTitle.vue",
  "app/components/ui/sheet/SheetTrigger.vue",
  "app/components/ui/sheet/index.ts",
  "app/components/ui/sheet/variants.ts",
  "app/components/ui/switch/Switch.vue",
  "app/components/ui/switch/index.ts",
  "app/components/ui/tabs/Tabs.vue",
  "app/components/ui/tabs/TabsContent.vue",
  "app/components/ui/tabs/TabsList.vue",
  "app/components/ui/tabs/TabsTrigger.vue",
  "app/components/ui/tabs/index.ts",
  "app/components/ui/textarea/Textarea.vue",
  "app/components/ui/textarea/index.ts",
  "app/components/ui/toggle-group/ToggleGroup.vue",
  "app/components/ui/toggle-group/ToggleGroupItem.vue",
  "app/components/ui/toggle-group/index.ts",
  "app/components/ui/tooltip/Tooltip.vue",
  "app/components/ui/tooltip/TooltipContent.vue",
  "app/components/ui/tooltip/TooltipProvider.vue",
  "app/components/ui/tooltip/TooltipTrigger.vue",
  "app/components/ui/tooltip/index.ts",
] as const;

const l2ForbiddenImports = [
  /^@\/core\/(?:agent-deerflow|api|artifacts|auth|channels|config|models|settings|sidecar|skills|tasks|threads|uploads)(?:\/|$)/,
  /^@\/components\/(?:chat|workspace)(?:\/|$)/,
  /^@\/composables(?:\/|$)/,
  /^@\/stores(?:\/|$)/,
  /^#(?:app|imports)(?:\/|$)/,
];

describe("L2 reusable UI boundary", () => {
  it("freezes the exact reusable source set and final L2 headers", () => {
    const missing: string[] = [];
    for (const file of l2Files) {
      const source = readFileSync(
        new URL(`../${file}`, import.meta.url),
        "utf8",
      );
      if (!/【架构位置】\s+L2(?:\s|$)/.test(source)) missing.push(file);
      if (source.includes("L2 候选")) missing.push(`${file}: candidate`);
    }
    expect(missing).toEqual([]);
  });

  it("keeps L2 independent from DeerFlow product wiring", () => {
    const violations: string[] = [];
    for (const file of l2Files) {
      const source = stripComments(
        readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
      );
      for (const match of source.matchAll(
        /(?:from\s+|import\s*)["']([^"']+)["']/g,
      )) {
        const specifier = match[1] ?? "";
        if (l2ForbiddenImports.some((pattern) => pattern.test(specifier))) {
          violations.push(`${file}: ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("uses artifacts as a one-way extension consumer", () => {
    const artifactPanel = readFileSync(
      new URL(
        "../app/components/workspace/artifacts/ArtifactPanel.vue",
        import.meta.url,
      ),
      "utf8",
    );
    const artifactPreview = readFileSync(
      new URL(
        "../app/components/workspace/artifacts/ArtifactPreview.vue",
        import.meta.url,
      ),
      "utf8",
    );
    expect(artifactPanel).toContain(
      'import ArtifactPreview from "./ArtifactPreview.vue"',
    );
    expect(artifactPreview).toContain(
      'import StreamMarkdown from "@/components/markdown/StreamMarkdown.vue"',
    );
  });
});
