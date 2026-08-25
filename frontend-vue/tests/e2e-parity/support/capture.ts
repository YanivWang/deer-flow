/*
  【文件职责】     在一个应用上跑完一个场景，取下可比对的样本：可访问性树 + API 请求序列。
  【架构位置】     对照测试基础设施
  【主要导出】     ParityCapture · normalizeRequest · captureScenario
  【依赖关系】     ./scenarios · ../../../scripts/lib/aria-parity.mjs · @playwright/test
  【边界与注意】   取样只保留两边都会发的**产品请求**：`/api/` 下面的那些。框架自己的
                   资源与载荷请求（Next 的 `_next` 与 RSC、Nuxt 的 `_nuxt` 与 payload）
                   被丢掉，不是因为它们不重要，而是因为它们**天然不可能相同**——
                   两个框架各有自己的加载协议。把它们留在比对里，等于让报告的每一行
                   都在说「Next 不是 Nuxt」，真差异会淹死在里面。

                   请求按**多重集**比对，不比顺序。顺序有价值，但并发请求之间的先后
                   本来就没有保证，直接比顺序会得到一份随机变红的门禁。是否稳定到能
                   比顺序，由 diff.spec.ts 里的自一致性用例实测回答——在有测量结果
                   之前不加这条判据。

                   同理，归一化规则只能因为实测而增加：每一条都在抹掉信息。
                   目前只有一条，来自第一次测量：`/workspace/chats/new` 上两个应用
                   各自**在客户端生成**一个新线程 id，于是 `uploads/limits` 的路径
                   每次都不同，而且两边必然不同。它不是产品差异，是这个页面的定义。

                   但不能把所有 UUID 一律抹掉：那样「React 打开的是线程 1、Vue 打开
                   的是线程 2」也会一起消失，而那是货真价实的差异。所以判据是
                   **白名单**——场景自己声明它认识哪些 id，其余 UUID 形状的段才算
                   客户端生成。
*/

import type { Page, Request } from "@playwright/test";

import {
  MOCK_RUN_ID,
  MOCK_SIDECAR_THREAD_ID,
  MOCK_THREAD_ID,
  MOCK_THREAD_ID_2,
} from "../../e2e/utils/mock-api";

import { normalizeAriaSnapshot } from "../../../scripts/lib/aria-parity.mjs";
import {
  runScenario,
  type ParityDimension,
  type ParityScenario,
} from "./scenarios";

export type ParityCapture = {
  aria: string;
  /** 归一化后的产品 API 请求，按发出顺序。 */
  requests: string[];
};

/** 会随时间或随机数变化、且不体现产品行为的查询参数。 */
const VOLATILE_QUERY_KEYS = new Set(["_", "t", "ts", "cacheBust"]);

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 场景认识的 id。不在这里面的 UUID 形状路径段视为客户端生成。 */
export const KNOWN_IDS = new Set([
  MOCK_THREAD_ID,
  MOCK_THREAD_ID_2,
  MOCK_SIDECAR_THREAD_ID,
  MOCK_RUN_ID,
]);

/**
 * 把一个请求归一成 `METHOD /path?sorted-query`；不是产品 API 请求则返回 null。
 */
export function normalizeRequest(
  method: string,
  url: string,
  knownIds: ReadonlySet<string> = KNOWN_IDS,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!parsed.pathname.startsWith("/api/")) return null;

  const pathname = parsed.pathname
    .split("/")
    .map((segment) =>
      UUID_SEGMENT.test(segment) && !knownIds.has(segment)
        ? "«generated»"
        : segment,
    )
    .join("/");

  const params = [...parsed.searchParams.entries()]
    .filter(([key]) => !VOLATILE_QUERY_KEYS.has(key))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`);
  const query = params.length ? `?${params.join("&")}` : "";
  return `${method.toUpperCase()} ${pathname}${query}`;
}

/**
 * 跑一个场景并取样。
 *
 * settle 之后再静置一小段：有些请求是渲染完成后才发的（token 用量、features）。
 * 静置窗口是取样的一部分，两个应用用同一个值，否则「谁被多等了一会儿」会变成
 * 一条假差异。
 */
export async function captureScenario(
  page: Page,
  base: string,
  scenario: ParityScenario,
  dimension: ParityDimension,
  settleMs = 700,
): Promise<ParityCapture> {
  const requests: string[] = [];
  const onRequest = (request: Request) => {
    const normalized = normalizeRequest(request.method(), request.url());
    if (normalized) requests.push(normalized);
  };
  page.on("request", onRequest);
  try {
    await runScenario(page, base, scenario, dimension);
    await page.waitForTimeout(settleMs);
    const aria = normalizeAriaSnapshot(
      await page.locator("body").ariaSnapshot(),
    );
    return { aria, requests };
  } finally {
    page.off("request", onRequest);
  }
}
