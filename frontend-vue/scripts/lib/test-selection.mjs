/*
  【文件职责】     回答「此刻哪些上游测试可以搬」以及「搬过来叫什么名字、归哪个 project」。
  【对应 frontend/】 无（工具链）
  【架构位置】     构建脚本
  【主要导出】     selectPortableTests / selectWaiting / targetPathOf / projectOf
  【依赖关系】     被 rstest-to-vitest.mjs 与 collected-vs-manifest.mjs 共用
  【边界与注意】   codemod 与对账脚本**必须**共用这一份判断。各写一份的话，
                   对账脚本就会去核对 codemod 自己声称搬了什么，
                   而不是核对「manifest 说该有的都在」——那种对账是自证。

                   判据是**传递闭包**，不是直接目标。测试台账的 targets 只记直接被测模块；
                   一个 COPIED 模块完全可能 import 到还没落地的 RETYPED（实测 43 个里有 23 个
                   这样），跑起来就是 Cannot find package。

                   试过、否决了：按 vi.mock 剪枝。被 mock 的模块理论上不会加载，
                   据此剪枝能多搬 7 个。实测这 7 个全部失败——vi.mock 仍然要求
                   路径可解析，而且只在**导入方的 specifier 与 mock 的 specifier 同形**时
                   才拦得住（`@/core/config` 对 `@/core/config` 成，对 `../config` 不成）。
                   这依赖 vitest 的解析细节，换个版本就可能悄悄变。宁可少搬：
                   口径与 06 对 COPIED 的取舍一致——说小了只是少省点事，说大了会架空门禁。
*/

/** 文件名后缀 → vitest project，口径与 vitest.config.ts 的三个 include 一致。 */
export function projectOf(bucket) {
  return bucket === "M1_DOM" ? "dom" : "node";
}

/** 落到 frontend-vue 的路径。DOM 档改名带 `.dom.` 中缀，交给 dom project 收集。 */
export function targetPathOf(entry) {
  const suffix =
    projectOf(entry.bucket) === "dom" ? ".dom.test.ts" : ".test.ts";
  return `tests/unit/core/${entry.source.replace(/\.test\.tsx?$/, suffix)}`;
}

function reachable(roots, depsOf) {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length) {
    const current = queue.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    for (const dep of depsOf(current)) if (!seen.has(dep)) queue.push(dep);
  }
  return seen;
}

/**
 * 一个测试可搬，当且仅当它不在 DEFERRED 档，且它**实际会加载**的模块全部已落地。
 *
 * `landed` 是已落地的分类集合，按里程碑推进：M1 窗口 2 只有 COPIED，
 * 下一个窗口加上 RETYPED。差一个模块就跑不起来——与其让它红着，
 * 不如明确地还没搬，由对账脚本盯住「该搬的都搬了」。
 */
export function selectPortableTests(testManifest, coreManifest, landed) {
  return partition(testManifest, coreManifest, landed).portable;
}

/** 不在 DEFERRED 档、但依赖还没全部落地的——本窗口有意不搬，需要在证据里点名。 */
export function selectWaiting(testManifest, coreManifest, landed) {
  return partition(testManifest, coreManifest, landed).waiting;
}

export function partition(testManifest, coreManifest, landed) {
  const landedSet = new Set(landed);
  const classOf = new Map(coreManifest.files.map((f) => [f.source, f.class]));
  const bySourceMap = new Map(coreManifest.files.map((f) => [f.source, f]));
  const depsOf = (source) => bySourceMap.get(source)?.internalDeps ?? [];

  const portable = [];
  const waiting = [];
  for (const entry of testManifest.files) {
    if (entry.bucket === "DEFERRED") continue;

    const needed = reachable(
      entry.targets.map((t) => t.source),
      depsOf,
    );
    const missing = [...needed]
      .filter((source) => !landedSet.has(classOf.get(source)))
      .sort();

    if (entry.targets.length > 0 && missing.length === 0) portable.push(entry);
    else waiting.push({ ...entry, missing });
  }
  const bySource = (a, b) => a.source.localeCompare(b.source);
  return { portable: portable.sort(bySource), waiting: waiting.sort(bySource) };
}
