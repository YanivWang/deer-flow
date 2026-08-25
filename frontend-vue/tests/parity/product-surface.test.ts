/*
  【文件职责】     与兄弟应用 frontend/ 做产品表面对照，并守住对齐范围的豁免定义不过期。
  【架构位置】     对照测试（非产品门禁）
  【主要导出】     无
  【依赖关系】     app/pages/** · baseline/react-parity-scope.json · ../frontend/src/**（缺席则整组跳过）
  【边界与注意】   放在 tests/parity/ 而不是 tests/guards/，是为了让「需要另一个应用才能跑」
                   这件事在目录层面就看得见。本仓的 install/build/test/e2e 都不依赖它。

                   豁免清单本身是**数据**（baseline/react-parity-scope.json），不是散文。
                   上一版豁免写在 ARCHITECTURE.md 的一节里，那节被整段删除之后
                   /pricing 与 /about 当场被判成违规并删掉，而没有任何门禁能说出
                   那是一次决定还是一次事故。这里的每条断言都让豁免在过期时变红。
*/

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const vuePages = fileURLToPath(new URL("../../app/pages", import.meta.url));
const reactSource = join(repoRoot, "frontend/src");
const reactPages = join(reactSource, "app");

/**
 * 这份用例做的是与兄弟应用的对照，因此它**必须**能在 `frontend/` 不存在时跳过：
 * 本仓的构建、测试与 e2e 都不依赖那个目录（见 `make standalone-check`）。
 * 对照只是在两者并存期间的额外证据，不是产品门禁。
 */
const upstreamPresent = existsSync(reactPages);

const scope = JSON.parse(
  readFileSync(
    new URL("../../baseline/react-parity-scope.json", import.meta.url),
    "utf8",
  ),
) as {
  exemptRoutes: { routes: string[] };
  pendingRoutes: { routes: string[] };
  contentExemptRoutes: { routes: string[] };
  exemptUpstreamPaths: { paths: string[] };
  forbiddenUpstreamModules: { modules: { specifier: string; path: string }[] };
};

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
    //
    // contentExemptRoutes 不在这里开口子：那是「路由两边都有、内容不比对」，
    // 不是「Vue 可以多一条路由」。两者混为一谈正是上一轮删错页面的原因。
    expect([...vue].filter((route) => !react.has(route)).sort()).toEqual([]);
  });

  /*
    反方向：React 有、Vue 还没有的路由。

    直接断言差集为空会让这条门禁从落地第一天起就是红的（内容站还没做），而常红的
    门禁最后一定被人加 skip 关掉——那比没有门禁更糟，因为它看起来还在。所以钉的是
    **签入的清单**，双向收紧：多出一条立刻红，少一条也红。

    清单拆成两份不是形式主义。合成一份的话，上游新增的路由可以被顺手塞进去，
    「还没做」和「永远不做」在文件里长得一模一样；拆开之后，新路由落在两份之外，
    必须由人显式选一边。与 baseline/i18n-keys.json 的 unusedKeys 同一套办法。
  */
  it("keeps every missing route classified as either exempt or pending", () => {
    const { react, vue } = routeSets();
    const missing = [...react].filter((route) => !vue.has(route)).sort();
    const exempt = scope.exemptRoutes.routes;
    const pending = scope.pendingRoutes.routes;

    expect(
      exempt.filter((route) => pending.includes(route)),
      "同一条路由不能既豁免又待办",
    ).toEqual([]);

    expect(
      missing,
      "React 路由集与 baseline/react-parity-scope.json 不一致：新缺失的路由要么" +
        "进 pendingRoutes（要做）、要么进 exemptRoutes（永远不做），二选一必须显式；" +
        "已经做出来的要从清单里删掉。",
    ).toEqual([...exempt, ...pending].sort());
  });

  it("keeps content-exempt routes present on both sides", () => {
    const { react, vue } = routeSets();

    // 内容豁免的前提是这条路由两边都还在。React 删了它，豁免就该跟着删；
    // Vue 删了它，Vue 就没有入口页了。任一边消失都说明这条豁免已经过期。
    for (const route of scope.contentExemptRoutes.routes) {
      expect({ route, react: react.has(route), vue: vue.has(route) }).toEqual({
        route,
        react: true,
        vue: true,
      });
    }
  });

  it("keeps the exempt upstream paths pointing at something real", () => {
    for (const path of scope.exemptUpstreamPaths.paths) {
      expect({ path, exists: existsSync(join(repoRoot, path)) }).toEqual({
        path,
        exists: true,
      });
    }
  });

  /*
    禁止移植的死代码。React 里这些模块一个导入方都没有，按「React 没有的 Vue 不许有」，
    搬进 Vue 等于凭空新增差异。

    反过来才是这条断言真正的价值：上游一旦开始消费其中某个，它就从死代码变成了
    Vue 欠下的实现，而这件事在没有断言的情况下没有任何信号——upstream-drift 只报
    「文件改了」，报不出「一个此前无人使用的模块被接上了」。
  */
  it("keeps the forbidden-to-port modules unconsumed upstream", () => {
    const sources = filesBelow(reactSource).filter(
      (file) => file.endsWith(".ts") || file.endsWith(".tsx"),
    );

    for (const { specifier, path } of scope.forbiddenUpstreamModules.modules) {
      const absolute = join(repoRoot, path);
      expect({ path, exists: existsSync(absolute) }).toEqual({
        path,
        exists: true,
      });

      const consumers = sources
        .filter((file) => file !== absolute)
        .filter((file) => readFileSync(file, "utf8").includes(`${specifier}"`))
        .map((file) => relative(repoRoot, file))
        .sort();
      expect(
        { specifier, consumers },
        `${specifier} 在 React 侧已经有消费者，它不再是死代码：Vue 从此欠它一个实现，` +
          "把它移出 forbiddenUpstreamModules 并纳入正常对齐工作。",
      ).toEqual({ specifier, consumers: [] });
    }
  });

  it("does not expose feedback until the React message-list call site does", () => {
    const reactMessageList = readFileSync(
      join(reactSource, "components/workspace/messages/message-list.tsx"),
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
      join(reactSource, "components/workspace/input-box.tsx"),
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
