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
  locateTarget,
  runScenario,
  type ParityDimension,
  type ParityScenario,
  type ParityTarget,
} from "./scenarios";

export type ParityCapture = {
  aria: string;
  /** 归一化后的产品 API 请求，按发出顺序。 */
  requests: string[];
  /** 场景锚点的盒模型与关键计算样式。 */
  geometry: Record<string, GeometrySample | null>;
};

/**
 * 一个锚点的可见几何与色板。
 *
 * 只取用户能看见的量：位置、尺寸、前景/背景色、字号。不取 class、不取内边距的
 * 具体来源、也不取组件库的包装层——那些是 ARCHITECTURE 里只对齐可观察行为的地方。
 */
export type GeometrySample = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  background: string;
  fontSize: string;
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
/** 锚点的稳定标识。两个应用用同一份场景数据，所以标识天然一致。 */
export function targetLabel(target: ParityTarget): string {
  if ("testId" in target) return `testId:${target.testId}`;
  if ("selector" in target) return `selector:${target.selector}`;
  if ("role" in target) return `role:${target.role}[${String(target.name)}]`;
  return `text:${String(target.text)}`;
}

async function sampleGeometry(
  page: Page,
  scenario: ParityScenario,
): Promise<Record<string, GeometrySample | null>> {
  const samples: Record<string, GeometrySample | null> = {};
  // 只取 settle 里的 visible 锚点：它们是场景定义的「稳定态可见元素」。
  // click/fill 的目标在交互后可能已经移动或消失，拿它们量几何是在量时序。
  for (const step of scenario.settle) {
    if (step.kind !== "visible") continue;
    const label = targetLabel(step.target);
    const locator = locateTarget(page, step.target).first();
    samples[label] = await locator
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = globalThis.getComputedStyle(element);
        const round = (value: number) => Math.round(value * 10) / 10;
        /*
          计算样式给出的颜色**记法**两边不同：实测 React 侧序列化成
          `lab(2.75381 0 0)`，Vue 侧是 `oklch(0.145 0 0)`——而这两个是同一个颜色
          （都解析成 rgba(10,10,10,255)）。直接比字符串等于在比记法，会让台账里
          塞满假条目，而假条目比没有条目更糟：它会让人不再相信这份清单。
          让浏览器自己画一像素再读回来，比的就是最终呈现的颜色。
        */
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        const toRgba = (value: string) => {
          if (!ctx) return value;
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = "#000";
          ctx.fillStyle = value;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
          return `rgba(${r},${g},${b},${a})`;
        };
        return {
          x: round(rect.x),
          y: round(rect.y),
          width: round(rect.width),
          height: round(rect.height),
          color: toRgba(style.color),
          background: toRgba(style.backgroundColor),
          fontSize: style.fontSize,
        };
      })
      .catch(() => null);
  }
  return samples;
}

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
    const geometry = await sampleGeometry(page, scenario);
    return { aria, requests, geometry };
  } finally {
    page.off("request", onRequest);
  }
}
