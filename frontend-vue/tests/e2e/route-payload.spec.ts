/*
  【文件职责】     按路由计量浏览器**真正下载**的 JS，并守住首屏预算与关键路径成分。
  【架构位置】     E2E 产品合同（mock Gateway）
  【主要导出】     无；Playwright cases
  【依赖关系】     baseline/route-payload-budget.json · .output/public/_nuxt
  【边界与注意】   为什么不复用 `make asset-budget`：那条门禁把 `.output` 里**全部** 469 个
                   chunk 加起来（13.9 MB），而用户打开工作区只下载 55 个文件 / 1.8 MB。
                   两个数没有关系——加一条懒加载路由会让它变大，把关键路径上的真实回归
                   淹掉。实测就是这样：katex 常年同步进首屏，那条门禁一次都没红过。

                   这里量的是业界通用的口径（Lighthouse CI / size-limit 用的那个）：
                   **一次真实导航中被请求的脚本**。字节数从磁盘上 Nuxt 预压缩的产物读，
                   不依赖 preview server 有没有开压缩，因此本机和 CI 得到同一个数。

                   除了总量还钉**成分**：mermaid / shiki / katex 这类重量级渲染器
                   必须留在关键路径之外，按需加载。总量预算会随功能自然上涨，
                   而「谁不许出现在首屏」是一条不随时间松动的结构约束。
*/

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI, MOCK_THREAD_ID } from "./utils/mock-api";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const ASSETS = join(ROOT, ".output/public/_nuxt");
const budgets = JSON.parse(
  readFileSync(join(ROOT, "baseline/route-payload-budget.json"), "utf8"),
) as {
  routes: Record<string, { files: number; raw: number; brotli: number }>;
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

async function measure(page: Page, path: string) {
  const requested = new Set<string>();
  page.on("request", (request) => {
    const url = request.url();
    if (url.endsWith(".js") && url.includes("/_nuxt/")) {
      requested.add(url.split("/").pop() as string);
    }
  });
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForLoadState("networkidle");

  let raw = 0;
  let brotli = 0;
  for (const file of requested) {
    const size = sizeOnDisk(file);
    raw += size.raw;
    brotli += size.brotli;
  }
  return { files: [...requested], raw, brotli };
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

test.describe("route payload", () => {
  for (const [route, budget] of Object.entries(budgets.routes)) {
    test(`${route} stays inside its initial payload budget`, async ({
      page,
    }) => {
      seedThread(page, "A plain sentence with no code, math or diagram.");
      const actual = await measure(page, route);
      // 始终打印实测值：调预算的人应该看到数字，而不是靠失败信息倒推。
      console.log(
        `PAYLOAD ${route.padEnd(24)} ${String(actual.files.length).padStart(3)} files  ` +
          `raw ${String(actual.raw).padStart(8)}  brotli ${String(actual.brotli).padStart(7)}`,
      );

      expect(
        {
          route,
          files: actual.files.length <= budget.files,
          raw: actual.raw <= budget.raw,
          brotli: actual.brotli <= budget.brotli,
        },
        `measured ${actual.files.length} files / ${actual.raw} raw / ${actual.brotli} brotli, ` +
          `budget ${budget.files} / ${budget.raw} / ${budget.brotli}`,
      ).toEqual({ route, files: true, raw: true, brotli: true });
    });
  }

  test("keeps heavyweight renderers out of the critical path", async ({
    page,
  }) => {
    seedThread(page, "A plain sentence with no code, math or diagram.");
    const actual = await measure(page, `/workspace/chats/${MOCK_THREAD_ID}`);

    /*
      纯文本会话不该为代码高亮、图表或公式排版付费。这三个库分别是
      848 KB / 1.42 MB / 264 KB 量级，同步进首屏一个就抵得上整个 UI 层。
    */
    const offenders: string[] = [];
    for (const file of actual.files) {
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
    expect(withDiagram.raw).toBeGreaterThan(
      budgets.routes[`/workspace/chats/${MOCK_THREAD_ID}`]?.raw ??
        budgets.routes["/workspace/chats/new"]!.raw,
    );
  });
});
