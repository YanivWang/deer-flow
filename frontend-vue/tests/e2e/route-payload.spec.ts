/*
  【文件职责】     按路由计量浏览器**真正下载**的 JS，并守住首屏预算与关键路径成分。
  【架构位置】     E2E 产品合同（mock Gateway）
  【主要导出】     无；Playwright cases
  【依赖关系】     baseline/route-payload-budget.json · .output/public/_nuxt
  【边界与注意】   为什么不复用 `make asset-budget`：那条门禁把 `.output` 里**全部**
                   chunk 加起来（十几 MB 量级），而用户打开工作区只下载其中几十个文件。
                   两个数没有关系——加一条懒加载路由会让它变大，把关键路径上的真实回归
                   淹掉。实测就是这样：katex 常年同步进首屏，那条门禁一次都没红过。

                   这里量的是业界通用的口径（Lighthouse CI / size-limit 用的那个）：
                   **一次真实导航中被请求的脚本**。字节数从磁盘上 Nuxt 预压缩的产物读，
                   不依赖 preview server 有没有开压缩，因此本机和 CI 得到同一个数。

                   **critical 与 prefetch 必须分开记。** 一次导航里被请求的脚本有两类：
                   浏览器为了把这一页跑起来而拉的（entry、modulepreload、运行期
                   `import()`），和 Nuxt 为**下一次**导航投机拉的
                   `<link rel="prefetch">`。后者是空闲期、最低优先级，不进关键路径。
                   把两者加在一起会得出错误结论：`/` 的 Reka 弹层机器曾被读成
                   「营销页加载了 65 KB 对话框代码」，实测它 100% 是 prefetch——
                   真正阻塞首屏的那 136 KB 里一个字节的 reka-ui 都没有。加总还会互相
                   掩盖：关键路径涨 30 KB、prefetch 少 30 KB，总量纹丝不动。

                   分类判据是 CDP 的 `initialPriority`：`<link rel="prefetch">` 是
                   `VeryLow`，其余（entry script、modulepreload、运行期动态 import）
                   都不是。这是浏览器自己的调度事实，不是从 HTML 反推的。

                   ⚠️ **它量的是浏览器怎么排的队，不是应用需不需要。** 如果某个
                   chunk 既被 Nuxt 投机 prefetch、又被应用同步 await，浏览器只会为
                   它发一次 `VeryLow` 请求（后续 import 命中 prefetch 缓存），这里
                   就把它记成 prefetch——数字变好看，首屏其实被一个最低优先级的
                   请求挡住了。i18n 按 locale 分包实测就是这个形状。所以：
                   **一次改动把大量字节从 critical 挪到 prefetch 时，先去看
                   `.output` 里那一页 HTML 的 link rel，确认它真的没人在等。**

                   除了总量还钉**成分**：mermaid / shiki / katex 这类重量级渲染器
                   必须留在关键路径之外，按需加载。成分检查覆盖 critical ∪ prefetch，
                   因为投机下载同样要用户付流量，退到只查 critical 会放松门禁。
                   总量预算会随功能自然上涨，而「谁不许出现在首屏」是一条不随时间
                   松动的结构约束。
*/

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI, MOCK_THREAD_ID } from "./utils/mock-api";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const ASSETS = join(ROOT, ".output/public/_nuxt");

type Group = { files: number; raw: number; brotli: number };
const budgets = JSON.parse(
  readFileSync(join(ROOT, "baseline/route-payload-budget.json"), "utf8"),
) as {
  routes: Record<string, { critical: Group; prefetch: Group }>;
  criticalPathForbidden: string[];
};

function sizeOnDisk(file: string) {
  const raw = readFileSync(join(ASSETS, file)).byteLength;
  let brotli = raw;
  try {
    brotli = readFileSync(join(ASSETS, `${file}.br`)).byteLength;
  } catch {
    // 小文件 Nuxt 不预压缩；用 raw 计，宁可高估也不漏计。
  }
  return { raw, brotli };
}

function total(files: string[]) {
  let raw = 0;
  let brotli = 0;
  for (const file of files) {
    const size = sizeOnDisk(file);
    raw += size.raw;
    brotli += size.brotli;
  }
  return { files: files.length, raw, brotli };
}

type Measured = { critical: string[]; prefetch: string[]; all: string[] };

async function measure(page: Page, path: string): Promise<Measured> {
  const priority = new Map<string, string>();
  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  session.on("Network.requestWillBeSent", (event) => {
    const url = event.request.url;
    if (!url.endsWith(".js") || !url.includes("/_nuxt/")) return;
    // 同一文件只记第一次：重复请求走缓存，不代表第二次下载。
    const file = url.split("/").pop() as string;
    if (!priority.has(file)) priority.set(file, event.request.initialPriority);
  });

  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForLoadState("networkidle");
  await session.detach();

  const critical: string[] = [];
  const prefetch: string[] = [];
  for (const [file, initialPriority] of priority) {
    (initialPriority === "VeryLow" ? prefetch : critical).push(file);
  }
  return { critical, prefetch, all: [...critical, ...prefetch] };
}

function seedThread(page: Page, content: string) {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: MOCK_THREAD_ID,
        title: "Route payload",
        messages: [
          { type: "human", id: "h", content: "hi" },
          { type: "ai", id: "a", content },
        ],
      },
    ],
  });
}

const PLAIN = "A plain sentence with no code, math or diagram.";

test.describe("route payload", () => {
  for (const [route, budget] of Object.entries(budgets.routes)) {
    test(`${route} stays inside its initial payload budget`, async ({
      page,
    }) => {
      seedThread(page, PLAIN);
      const measured = await measure(page, route);
      const actual = {
        critical: total(measured.critical),
        prefetch: total(measured.prefetch),
      };
      // 始终打印实测值：调预算的人应该看到数字，而不是靠失败信息倒推。
      for (const group of ["critical", "prefetch"] as const) {
        const it = actual[group];
        console.log(
          `PAYLOAD ${route.padEnd(24)} ${group.padEnd(8)} ` +
            `${String(it.files).padStart(3)} files  ` +
            `raw ${String(it.raw).padStart(8)}  brotli ${String(it.brotli).padStart(7)}`,
        );
      }

      const within = (a: Group, b: Group) => ({
        files: a.files <= b.files,
        raw: a.raw <= b.raw,
        brotli: a.brotli <= b.brotli,
      });
      const pass = { files: true, raw: true, brotli: true };
      expect(
        {
          route,
          critical: within(actual.critical, budget.critical),
          prefetch: within(actual.prefetch, budget.prefetch),
        },
        `measured critical ${actual.critical.files} files / ${actual.critical.raw} raw / ` +
          `${actual.critical.brotli} brotli (budget ${budget.critical.files} / ` +
          `${budget.critical.raw} / ${budget.critical.brotli}); ` +
          `prefetch ${actual.prefetch.files} files / ${actual.prefetch.raw} raw / ` +
          `${actual.prefetch.brotli} brotli (budget ${budget.prefetch.files} / ` +
          `${budget.prefetch.raw} / ${budget.prefetch.brotli})`,
      ).toEqual({ route, critical: pass, prefetch: pass });
    });
  }

  test("keeps heavyweight renderers out of the critical path", async ({
    page,
  }) => {
    seedThread(page, PLAIN);
    const measured = await measure(page, `/workspace/chats/${MOCK_THREAD_ID}`);

    /*
      纯文本会话不该为代码高亮、图表或公式排版付费。这三个库分别是
      848 KB / 1.42 MB / 264 KB 量级，同步进首屏一个就抵得上整个 UI 层。
      检查覆盖 prefetch：投机下载也是用户付的流量。
    */
    const offenders: string[] = [];
    for (const file of measured.all) {
      const source = readFileSync(join(ASSETS, file), "utf8");
      for (const marker of budgets.criticalPathForbidden) {
        if (source.includes(marker)) offenders.push(`${file}: ${marker}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("loads the heavyweights only when the content needs them", async ({
    page,
  }) => {
    seedThread(page, "```mermaid\ngraph TD;\nA-->B;\n```\n");
    const withDiagram = await measure(
      page,
      `/workspace/chats/${MOCK_THREAD_ID}`,
    );
    await expect(page.locator("[data-mermaid-diagram], svg")).not.toHaveCount(
      0,
    );

    // 反方向证明：懒加载确实生效，而不是「哪种内容都不加载」。
    const plainBudget =
      budgets.routes[`/workspace/chats/${MOCK_THREAD_ID}`] ??
      budgets.routes["/workspace/chats/new"]!;
    expect(total(withDiagram.critical).raw).toBeGreaterThan(
      plainBudget.critical.raw,
    );
  });
});
