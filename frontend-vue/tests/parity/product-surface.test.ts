/*
  【文件职责】     与兄弟应用 frontend/ 做产品表面对照，报告 Vue 是否漏了页面或入口。
  【架构位置】     对照测试（非产品门禁）
  【主要导出】     无
  【依赖关系】     app/pages/** · ../frontend/src/app/**（缺席则整组跳过）
  【边界与注意】   放在 tests/parity/ 而不是 tests/guards/，是为了让「需要另一个应用才能跑」
                   这件事在目录层面就看得见。本仓的 install/build/test/e2e 都不依赖它。
*/

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const vuePages = fileURLToPath(new URL("../../app/pages", import.meta.url));
const reactPages = fileURLToPath(
  new URL("../../../frontend/src/app", import.meta.url),
);

/**
 * 这份用例做的是与兄弟应用的对照，因此它**必须**能在 `frontend/` 不存在时跳过：
 * 本仓的构建、测试与 e2e 都不依赖那个目录（见 `make standalone-check`）。
 * 对照只是在两者并存期间的额外证据，不是产品门禁。
 */
const upstreamPresent = existsSync(reactPages);

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

function normalizedRoute(path: string) {
  const segments = path
    .replace(/\.(vue|tsx)$/, "")
    .split("/")
    .filter((segment) => segment !== "index" && segment !== "page")
    .filter((segment) => !/^\(.+\)$/.test(segment))
    .map((segment) => segment.replace(/^\[\.\.\.(.+)]$/, "[...$1]"));
  return `/${segments.join("/")}`;
}

function routeSets() {
  const react = new Set(
    filesBelow(reactPages)
      .filter((file) => file.endsWith("/page.tsx"))
      .map((file) => normalizedRoute(relative(reactPages, file))),
  );
  const vue = new Set(
    filesBelow(vuePages)
      .filter((file) => file.endsWith(".vue"))
      .map((file) => relative(vuePages, file))
      .filter((file) => !file.startsWith("__m0/"))
      .map(normalizedRoute),
  );
  return { react, vue };
}

describe.skipIf(!upstreamPresent)("React-observable product surface", () => {
  it("does not expose a Vue page React does not have", () => {
    const { react, vue } = routeSets();

    // 没有例外集合。`/about` 与 `/pricing` 曾经列在这里，而 React 从来没有这两条
    // 路由——它的落地页导航只链到 `/{lang}/docs` 与 `/blog/posts`。一个写死的
    // 例外集合就是豁免，只是换了个不带「豁免」字样的名字，按关键词搜不到。
    expect([...vue].filter((route) => !react.has(route)).sort()).toEqual([]);
  });

  /*
    反方向：React 有、Vue 还没有的路由。

    直接断言差集为空会让这条门禁从落地第一天起就是红的（docs 与 blog 都还没做），
    而常红的门禁最后一定被人加 skip 关掉——那比没有门禁更糟，因为它看起来还在。
    所以钉的是**签入的缺失清单**，双向收紧：多出一条立刻红，少一条也红。
    于是它从第一天就是绿的，而清单只能靠真把页面做出来才变短。
    与 baseline/i18n-keys.json 的 unusedKeys 同一套办法。
  */
  it("keeps the missing-route list exact, so it can only shrink", () => {
    const { react, vue } = routeSets();
    const missing = [...react].filter((route) => !vue.has(route)).sort();
    const baseline = JSON.parse(
      readFileSync(
        new URL(
          "../../baseline/react-routes-missing-in-vue.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as { routes: string[] };

    expect(
      missing,
      "React 路由集与 baseline/react-routes-missing-in-vue.json 不一致：" +
        "新缺失要么补上页面、要么显式加进清单；已经做出来的要从清单里删掉。",
    ).toEqual([...baseline.routes].sort());
  });

  it("does not expose feedback until the React message-list call site does", () => {
    const reactMessageList = readFileSync(
      new URL(
        "../../../frontend/src/components/workspace/messages/message-list.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const reactCallSites = [
      ...reactMessageList.matchAll(/<MessageListItem\b([\s\S]*?)\/>/g),
    ];
    const reactPassesFeedback = reactCallSites.some((match) =>
      /\bfeedback\s*=/.test(match[1] ?? ""),
    );
    const vueMessageList = readFileSync(
      new URL("../../app/components/chat/MessageList.vue", import.meta.url),
      "utf8",
    );

    if (!reactPassesFeedback) {
      expect(vueMessageList).not.toMatch(
        /ThumbsUp|ThumbsDown|actions\.(?:helpful|notHelpful)/,
      );
    }
  });

  it("does not mount assets from the sibling React project at runtime", () => {
    const nuxtConfig = readFileSync(
      new URL("../../nuxt.config.ts", import.meta.url),
      "utf8",
    );
    expect(nuxtConfig).not.toContain('new URL("../frontend/');
  });

  it("keeps the attachment entry as the same keyboard-operable button surface", () => {
    const reactComposer = readFileSync(
      new URL(
        "../../../frontend/src/components/workspace/input-box.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const vueComposer = readFileSync(
      new URL("../../app/components/chat/ChatComposer.vue", import.meta.url),
      "utf8",
    );

    expect(reactComposer).toMatch(
      /<PromptInputButton[\s\S]*?data-testid="add-attachments-button"/,
    );
    expect(vueComposer).toMatch(
      /<button[\s\S]*?data-testid="add-attachments-button"/,
    );
    expect(vueComposer).not.toMatch(
      /<label[\s\S]*?data-testid="add-attachments-button"/,
    );
  });
});
