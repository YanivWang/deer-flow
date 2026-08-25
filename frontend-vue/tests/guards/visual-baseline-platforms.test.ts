/*
  【文件职责】     把「截图基线覆盖哪些平台」和「CI 跑不跑 e2e-visual」绑成一条不变量。
  【架构位置】     仓库门禁（Vitest）
  【主要导出】     无；Vitest cases
  【依赖关系】     tests/e2e-visual/**-snapshots · ../.github/workflows/frontend-vue-verify.yml
  【边界与注意】   `make e2e-visual` 现在**只在本机有效**：9 张基线全是 `-darwin`，
                   而 CI 跑 Linux。一条只在一台机器上生效的门禁保护不了任何东西，
                   而且这个事实此前只写在两处注释里——注释不会红。

                   这条 guard 把它变成可执行的约束：**有基线的平台集合，必须等于
                   门禁实际运行的平台集合。** 两个方向都要挡：

                   - 签入 `-linux` 基线却没把 `make e2e-visual` 接进 CI —— 基线白签，
                     门禁照旧不存在；
                   - 把 `make e2e-visual` 接进 CI 却没有 `-linux` 基线 —— Playwright
                     以「missing snapshot」失败，CI 从此常红，而常红的门禁最后一定
                     被人加 `continue-on-error` 关掉。

                   第二条是本仓真正怕的那个形状：把一条诚实的本机门禁换成一条
                   假的 CI 门禁，比维持现状更糟。

                   还有一条只在多平台时才咬人的：各平台的基线**文件名集合必须一致**。
                   只重生成了 9 张里的 6 张，剩下 3 张在 CI 上就是 missing snapshot，
                   而本机全绿——正是上面那种「本机看不见」的形状。

                   ── 怎么解除现状（记在这里，因为这是唯一会被读到的地方）──
                   不要在 Apple Silicon 上用 QEMU 跑 amd64 容器生成基线：那样产出的
                   字体栅格化与真实 amd64 runner 是否一致**没有证据**，容差
                   `maxDiffPixelRatio: 0.01` + `fullPage` 又足够宽到把差异吞掉，
                   于是得到一条「看起来绿、其实什么都没在守」的门禁。本机实测：
                   `docker run --platform linux/amd64 alpine:3` 连一个 4 MB 镜像都
                   起不来（>15 min 无输出），Docker Desktop 设置里也没有开 Rosetta。

                   可接受的路径只有一条：**让 CI 自己生成一次**——在
                   `frontend-vue-verify.yml` 里临时加一步
                   `npx playwright test --config=playwright.visual.config.ts --update-snapshots`
                   并把产物作为 artifact 上传，下载、签入 `-linux` 基线，同一改动里
                   把 `make e2e-visual` 接进 CI（本 guard 会要求这两件事同时发生）。
                   之后镜像/runner 升级导致的基线漂移，按同样方式重生成。
*/

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const workflow = fileURLToPath(
  new URL(
    "../../../.github/workflows/frontend-vue-verify.yml",
    import.meta.url,
  ),
);

/** `<case>-<project>-<platform>.png` —— Playwright 的快照命名。 */
const SNAPSHOT = /^(.+)-([a-z]+)-(darwin|linux|win32)\.png$/;

function snapshotDirs(directory: string): string[] {
  return readdirSync(`${root}${directory}`, { withFileTypes: true }).flatMap(
    (entry) => {
      if (!entry.isDirectory()) return [];
      const path = `${directory}/${entry.name}`;
      return entry.name.endsWith(".spec.ts-snapshots")
        ? [path]
        : snapshotDirs(path);
    },
  );
}

const baselines = snapshotDirs("tests/e2e-visual").flatMap((directory) =>
  readdirSync(`${root}${directory}`).flatMap((file) => {
    const match = SNAPSHOT.exec(file);
    return match ? [{ directory, case: match[1]!, platform: match[3]! }] : [];
  }),
);

const platforms = [...new Set(baselines.map((it) => it.platform))].sort();

/**
 * CI 是否真的运行产品截图。
 *
 * 只认没有被注释掉的 `make e2e-visual`——现在的 workflow 注释里就提到了这个
 * 命令名，按裸字符串匹配会一直假红。
 */
const runsInCI = readFileSync(workflow, "utf8")
  .split("\n")
  .filter((line) => !/^\s*#/.test(line))
  .some((line) => /\bmake\s+e2e-visual\b/.test(line));

describe("视觉基线与 CI 的平台一致性", () => {
  it("至少有一份基线，否则这条 guard 自己是空转的", () => {
    expect(baselines.length).toBeGreaterThan(0);
    expect(platforms.length).toBeGreaterThan(0);
  });

  it("有 -linux 基线，当且仅当 CI 跑 make e2e-visual", () => {
    expect(
      { linuxBaselines: platforms.includes("linux"), runsInCI },
      platforms.includes("linux")
        ? "签入了 -linux 基线就必须同时把 make e2e-visual 接进 frontend-vue-verify.yml，否则基线白签"
        : "CI 要跑 make e2e-visual 就必须先有 -linux 基线，否则每次都是 missing snapshot，门禁常红",
    ).toEqual({ linuxBaselines: runsInCI, runsInCI });
  });

  it("每个平台的基线覆盖同一组用例", () => {
    const byPlatform = new Map<string, Set<string>>();
    for (const baseline of baselines) {
      const key = `${baseline.directory}::${baseline.platform}`;
      (byPlatform.get(key) ?? byPlatform.set(key, new Set()).get(key)!).add(
        baseline.case,
      );
    }
    const perDirectory = new Map<string, Map<string, string[]>>();
    for (const [key, cases] of byPlatform) {
      const [directory, platform] = key.split("::") as [string, string];
      const entry =
        perDirectory.get(directory) ??
        perDirectory.set(directory, new Map()).get(directory)!;
      entry.set(platform, [...cases].sort());
    }
    for (const [directory, entry] of perDirectory) {
      const [reference, ...rest] = [...entry.entries()];
      for (const [platform, cases] of rest) {
        expect(
          cases,
          `${directory} 的 ${platform} 基线与 ${reference![0]} 不是同一组用例；` +
            `少的那几张在对应平台上是 missing snapshot，而在本机全绿`,
        ).toEqual(reference![1]);
      }
    }
  });
});
