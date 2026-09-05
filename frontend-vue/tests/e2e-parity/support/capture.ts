/*
  【文件职责】     在一个应用上跑完一个场景，取下可比对的样本：可访问性树 + API 请求序列。
  【架构位置】     对照测试基础设施
  【主要导出】     ParityCapture · normalizeRequest · sampleGeometry · captureScenario
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
  type ParityState,
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
 *
 * `x` / `y` 是**未滚动布局里的文档坐标**，不是视口坐标，见 sampleGeometry。
 */
export type GeometrySample = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  background: string;
  fontSize: string;
  /*
    元素**自己**的 opacity。

    加这一档是因为它是一处真的盲区：`opacity: 0` 的元素**照样在可访问性树里**
    （不是 `display:none` 也不是 `visibility:hidden`），照样有 x/y/宽高，
    computed `color` 也一点不变——也就是说「一边看得见、另一边看不见」这件事，
    aria、几何、请求三档**同时**都报不出来。消息动作条那一排就是这样：
    两个应用都写 `opacity-0 group-hover:opacity-100`，而在这之前没有任何门禁
    量过它到底是 0 还是 1。

    只取元素自己的值，不把祖先链乘起来：乘起来的话，一处祖先透明度差异会让
    它下面每个锚点同时报一行，而那是同一处差异的 N 个投影（坑 219 的同一件事）。
  */
  opacity: string;
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

/**
 * 取每个锚点的几何与色板。
 *
 * 位置量的是**布局**，不是滚动状态——这是它与 `getBoundingClientRect()` 的全部区别。
 *
 * rect 给的是视口坐标，等于把祖先容器滚了多少也一起量了进去。实测：
 * `thread-history-mermaid` 的锚点在 stick-to-bottom 的会话流里，React 侧同一份布局
 * 量出来的 y 在 3/3/2/1/-1/4 之间跳（2026-08-26 单日统计 3,2,3,2,3,3,2,2），因为
 * mermaid 图是异步渲染的，内容高度一变容器就重新贴底；Vue 侧那条流没溢出，恒为 72。
 * 台账里那条 `Δ69` 因此**整条都是滚动状态**，与布局无关，却让门禁约一半概率变红。
 *
 * 所以把祖先链上每一层的 scrollLeft/scrollTop 加回去：容器滚多少，元素的视口坐标
 * 就少多少，两者相加恒等于未滚动布局里的文档坐标。页面级滚动也在这条链上
 * （documentElement.scrollTop 就是 scrollY），不用另外加。
 *
 * **不是**「相对最近可滚动祖先的内容原点」。那个写法量过，它换来的东西更糟：
 * 参照系变成各应用自己的 DOM。实测同一次取样里，mermaid 锚点 React 的最近可滚动
 * 祖先是会话流那个 div、Vue 那条流没溢出于是退回文档，两边的 x 明明都是 375.5，
 * 相对坐标却差 256；`integrations` 的 "Lark / Feishu CLI" 同样差 381，
 * `scheduled-tasks` 的 "Daily summary" 差 360。对照比的是两个应用，参照系必须与
 * 应用无关——文档原点是，最近可滚动祖先不是。
 *
 * 「量出来与滚到哪里无关」这条判据由 diff.spec.ts 的滚动不变性用例实测钉住，
 * 不是这里的注释说了算。
 */
export async function sampleGeometry(
  page: Page,
  scenario: ParityScenario,
  state: ParityState,
): Promise<Record<string, GeometrySample | null>> {
  const samples: Record<string, GeometrySample | null> = {};
  /*
    取 `settle` **与 `steps`** 里的 `visible` 锚点。

    此前只取 settle 那一半，理由写的是「click/fill 的目标在交互后可能已经移动或
    消失，拿它们量几何是在量时序」——**那句话只对 click/fill 成立**。
    `steps` 里的 `visible` 是另一回事：它是「这次交互该让什么出现」，
    场景本身就在等它稳定，拿它量几何与拿 settle 的锚点量没有区别。

    漏掉这一半的代价是线索 137 的正题：**靠交互才出现的东西，位置永远进不了台账**
    ——artifact 面板、agent 建成那屏、批量流的文件列表，几何档一格都没量过。
    wave 76 把它接上，新增约 20 个锚点。

    仍然**不取** click / fill 的目标：那些是「点哪里」，不是「该出现什么」，
    点完之后它可能已经不在了。
  */
  for (const step of [...scenario.settle, ...state.steps]) {
    if (step.kind !== "visible") continue;
    const label = targetLabel(step.target);
    const locator = locateTarget(page, step.target).first();
    /*
      **每个锚点最多等 2 秒。**

      `steps` 里的 `visible` 锚点到取样时可能已经不在了——`artifact-batched-stream`
      一路点过好几个文件，先前那几条 `visible` 早被换掉。`locator.evaluate` 自带
      auto-wait，用默认超时的话每个消失的锚点要卡满 30 秒：wave 76 第一版就是这么
      把整条 diff 用例从 4 分钟拖到 10 分钟超时的（报错是 context 被拆掉时的
      `page.route: Target page ... has been closed`，看不出真正的原因）。

      两秒够长：这里已经在 `settleMs` 之后，真还在的元素不需要等。
      两秒之后仍拿不到就记 `null`——**两边都是 `null` 时 diffGeometry 会跳过**，
      「两个应用都没有这个锚点」没有可比的几何。
    */
    samples[label] = await locator
      .evaluate(
        async (element) => {
          /** 未滚动布局里的文档坐标 + 尺寸。见函数头。 */
          const layoutBox = () => {
            const rect = element.getBoundingClientRect();
            let scrolledLeft = 0;
            let scrolledTop = 0;
            for (
              let ancestor = element.parentElement;
              ancestor;
              ancestor = ancestor.parentElement
            ) {
              scrolledLeft += ancestor.scrollLeft;
              scrolledTop += ancestor.scrollTop;
            }
            return {
              x: rect.x + scrolledLeft,
              y: rect.y + scrolledTop,
              width: rect.width,
              height: rect.height,
            };
          };

          /*
          先等布局停下来再量。

          实测：mermaid 场景里 React 侧同一个锚点的 y 在两次运行之间差 1px——
          它下面的图是异步渲染的，量早了就量到中间态。这类抖动不是产品差异，但
          它会让清单每跑一次变一行，而一份每次都变的清单等于没有清单。

          判据是「连续两帧盒模型不变」，不是「等固定毫秒」：固定等待在慢机器上
          仍然会量到中间态，只是概率低一点，而低概率的假差异比高概率的更难查。

          等的是**布局**盒模型。此前这里比的是视口 rect，于是在 stick-to-bottom
          的容器里它永远等不到「不再变」——变的是滚动而不是布局，加长判据
          （试过连续 3 帧、6 帧）自然也不收敛。
        */
          const frame = () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            );
          const boxOf = () => {
            const { x, y, width, height } = layoutBox();
            return `${x}|${y}|${width}|${height}`;
          };
          let previous = boxOf();
          for (let attempt = 0; attempt < 40; attempt++) {
            await frame();
            await frame();
            const current = boxOf();
            if (current === previous) break;
            previous = current;
          }

          const box = layoutBox();
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
            x: round(box.x),
            y: round(box.y),
            width: round(box.width),
            height: round(box.height),
            color: toRgba(style.color),
            background: toRgba(style.backgroundColor),
            fontSize: style.fontSize,
            opacity: style.opacity,
          };
        },
        undefined,
        { timeout: 2_000 },
      )
      .catch(() => null);
  }
  return samples;
}

export async function captureScenario(
  page: Page,
  base: string,
  scenario: ParityScenario,
  dimension: ParityDimension,
  state: ParityState,
  settleMs = 700,
): Promise<ParityCapture> {
  const requests: string[] = [];
  const onRequest = (request: Request) => {
    const normalized = normalizeRequest(request.method(), request.url());
    if (normalized) requests.push(normalized);
  };
  page.on("request", onRequest);
  try {
    await runScenario(page, base, scenario, dimension, state);
    await page.waitForTimeout(settleMs);
    const aria = normalizeAriaSnapshot(
      await page.locator("body").ariaSnapshot(),
    );
    const geometry = await sampleGeometry(page, scenario, state);
    return { aria, requests, geometry };
  } finally {
    page.off("request", onRequest);
  }
}
