/*
  【文件职责】     钉住几处「照抄上游 class 串」的可感知细节。
  【架构位置】     守卫
  【主要导出】     无；vitest 用例
  【依赖关系】     app/components/**
  【边界与注意】   这一份收的是**没有别的守卫盯着**的那几条：它们既不是图标、
                   也不是可访问名，改掉之后 aria 快照、对照台账、几何档、
                   单测一样都不会红——wave 72 的负向验证当场撞出两处假绿
                   （TodoList 的行高与光标、sidebar rail 的光标方向）。

                   **钉源码串而不是渲染读数**，因为这几处要么挂在很重的组件上
                   （ThreadSidebar），要么只在某个状态下才出现。代价写在这里：
                   它只保证「没人手滑删掉」，不保证「渲染出来真是那样」——
                   后者要靠 parity 探针（坑 204）。

                   **每一条都先剥注释再找**（坑 202）：这一节的说明文字里
                   逐字引用着要找的那些 class 名，不剥的话把 class 从元素上删掉、
                   断言照样绿。wave 72 在另一份守卫里刚踩过这一次。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appDir = fileURLToPath(new URL("../../app", import.meta.url));

function stripped(relativePath: string): string {
  return readFileSync(`${appDir}/${relativePath}`, "utf8")
    .replaceAll(/<!--[\s\S]*?-->/g, "")
    .replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

/** 找到含有 `needle` 的那一个开标签，返回它的静态 class 串。 */
function classOfTagContaining(source: string, needle: string): string {
  const tag = new RegExp(
    `<[a-zA-Z][^>]*${needle.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^>]*>`,
    "s",
  ).exec(source)?.[0];
  expect(tag, `找不到含 ${needle} 的标签`).toBeDefined();
  return /\bclass="([^"]*)"/.exec(tag!)?.[1] ?? "";
}

describe("照抄上游的 class 串", () => {
  /*
    上游 todo-list.tsx:45 那一层是
    `bg-accent flex min-h-8 shrink-0 cursor-pointer items-center justify-between
     px-4 text-sm transition-all duration-300 ease-out`。
    本仓原来是 `min-h-9` 且**没有 cursor-pointer**：整条头比上游高 4px，
    鼠标停在上面还是箭头（Tailwind 4 的 preflight 不给按钮小手，坑 206）。
  */
  it("TodoList 的折叠头是 min-h-8 + cursor-pointer + 300ms 过渡", () => {
    const source = stripped("components/workspace/TodoList.vue");
    const header = classOfTagContaining(source, "collapsed = !collapsed").split(
      /\s+/,
    );
    for (const token of [
      "min-h-8",
      "cursor-pointer",
      "transition-all",
      "duration-300",
      "ease-out",
    ]) {
      expect(header, `TodoList 折叠头少了 ${token}`).toContain(token);
    }
    expect(header).not.toContain("min-h-9");
  });

  /*
    上游 ui/sidebar.tsx:301 的 SidebarRail 有两条互斥的光标：展开时
    `cursor-w-resize`（往左＝收起），收起时 `cursor-e-resize`（往右＝展开）。
    本仓原来写死 `cursor-w-resize`——侧栏已经最窄了，鼠标还在说「往左拖」。
    wave 72 探针实测：同一屏 React 是 e-resize、本仓是 w-resize。
  */
  it("侧栏 rail 的光标随收起态翻向", () => {
    const source = stripped("components/workspace/ThreadSidebar.vue");
    const rail = /<button\b[^>]*data-sidebar="rail"[^>]*>/s.exec(source)?.[0];
    expect(rail, "找不到 sidebar rail").toBeDefined();
    expect(rail).toContain("cursor-e-resize");
    expect(rail).toContain("cursor-w-resize");
    // 静态 class 里不许再写死方向，否则动态那条被 twMerge 之外的顺序吃掉。
    expect(/\bclass="([^"]*)"/.exec(rail!)?.[1] ?? "").not.toMatch(
      /cursor-[ew]-resize/,
    );
  });

  /*
    **上游给了图标的按钮，本仓不许只有文字。**

    这一条 `icon-parity` 盯不住：它比的是**全仓的图标集合**与按文件的尺寸，
    而 Bell / Sparkles 在别处也用着，从这两个面板上删掉之后集合一点没变。
    wave 71 在 channels 上撞过同一类（四颗键一颗图标都没有），
    wave 72 在设置面板上又撞到三颗。

    上游出处：notification-settings-page.tsx:71 / :85 各一颗
    `<BellIcon className="mr-2 size-4" />`；skill-settings-page.tsx:95 是
    `<SparklesIcon className="size-4" />`。
  */
  it("设置面板里上游有图标的三颗键都带着图标", () => {
    const notification = stripped(
      "components/workspace/settings/NotificationSettings.vue",
    );
    expect(
      [...notification.matchAll(/<Bell class="mr-2 size-4" \/>/g)],
      "通知设置的两颗键各要一颗 BellIcon",
    ).toHaveLength(2);

    const skills = stripped("components/workspace/settings/SkillSettings.vue");
    expect(skills).toContain('<Sparkles class="size-4" />');
  });

  /*
    **toast 的尺寸逐条抄 sonner 的 CSS**，不是随手挑的 Tailwind 档位。
    出处是 `sonner/dist/index.mjs` 里 `[data-sonner-toast][data-styled=true]`：
    `padding:16px; font-size:13px; gap:6px; align-items:center;
     box-shadow:0 4px 12px rgba(0,0,0,.1); width:var(--width)`（`TOAST_WIDTH=356`），
    外层 `VIEWPORT_OFFSET=24px`、`GAP=14`。
    wave 74 两个应用同屏实测过一次：本仓原来是 420 宽 / `px-4 py-3` / 14px 字 /
    12px 间距 / `items-start` / `shadow-lg` / `top-3` / `gap-2`——**每一条都不一样**。

    错误态**不**染红边框：sonner 不按类型改边框色（那是 `richColors` 的行为，
    上游没开），类型由图标表达。
  */
  it("toast 的尺寸抄的是 sonner 的那一串", () => {
    const source = stripped("components/workspace/WorkspaceToaster.vue");
    const item = classOfTagContaining(
      source,
      'v-for="item in toast.toasts',
    ).split(/\s+/);
    for (const token of [
      "p-4",
      "text-[13px]",
      "gap-1.5",
      "items-center",
      "shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
    ]) {
      expect(item, `toast 少了 ${token}`).toContain(token);
    }
    expect(item).not.toContain("items-start");
    expect(source).not.toContain("border-destructive/40");

    const list = classOfTagContaining(
      source,
      'data-testid="workspace-toaster"',
    ).split(/\s+/);
    expect(list).toContain("w-[min(92vw,356px)]");
    expect(list).toContain("top-6");
    expect(list).toContain("gap-[14px]");

    /* sonner 的 `--toast-icon-margin-start:-3px` / `-end:4px`。 */
    const icon = classOfTagContaining(source, "KIND_ICON[item.kind]").split(
      /\s+/,
    );
    expect(icon).toContain("-ml-[3px]");
    expect(icon).toContain("mr-1");
  });

  /*
    **侧栏底部那颗触发器收起时换尺寸，不是只换内容。**
    上游 SidebarMenuButton 的 cva：base 里 `group-data-[collapsible=icon]:size-8!`，
    lg 档里 `group-data-[collapsible=icon]:p-0!`——收起时是一颗 32×32、内边距 0 的方钮。
    本仓的收起态走自己的 `collapsed` ref，那两条选择器永远不成立。
    wave 74 同屏实测：React 32×32 / padding 0，本仓 31×48 / padding 8，**高出 16px**。
  */
  it("侧栏底部触发器收起态是 32×32、内边距 0", () => {
    const source = stripped("components/workspace/ThreadSidebar.vue");
    const tag =
      /<button\b[^>]*data-testid="workspace-nav-menu-trigger"[^>]*>/s.exec(
        source,
      )?.[0];
    expect(tag, "找不到侧栏底部触发器").toBeDefined();
    // 尺寸走 :class 的两支，不是写死在 class 里。
    expect(/\bclass="([^"]*)"/.exec(tag!)?.[1] ?? "").not.toMatch(
      /\b(h-12|p-2|w-full)\b/,
    );
    expect(tag).toContain("h-12 w-full p-2");
    expect(tag).toContain("size-8 shrink-0 p-0");
  });

  /*
    上游 workspace-nav-chat-list.tsx:56 的禁用「Agents」入口：外层
    `cursor-not-allowed`，按钮 `text-muted-foreground/50` + SidebarMenuButton
    cva 自带的 `aria-disabled:pointer-events-none aria-disabled:opacity-50`。
    本仓原来一条都没有，于是这个点不动的入口**还会跟着鼠标高亮**。
  */
  it("禁用的 Agents 入口不高亮、不接指针、半透明", () => {
    const source = stripped("components/workspace/ThreadSidebar.vue");
    const button = classOfTagContaining(
      source,
      'aria-describedby="agents-disabled-description"',
    ).split(/\s+/);
    for (const token of [
      "text-muted-foreground/50",
      "aria-disabled:pointer-events-none",
      "aria-disabled:opacity-50",
    ]) {
      expect(button, `禁用入口少了 ${token}`).toContain(token);
    }
    expect(source).toContain("cursor-not-allowed");
  });
});
