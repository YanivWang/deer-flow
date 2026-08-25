/*
  【文件职责】     在共享 replay Gateway 上种一条内容固定的线程，供两个应用同时渲染。
  【架构位置】     对照测试基础设施
  【主要导出】     FIXTURE_THREAD_ID · FIRST_MARKER · SECOND_MARKER · seedFixtureThread
  【依赖关系】     replay Gateway 的 /api/test-only/seed-runs（只挂在这个 Gateway 上）
  【边界与注意】   直接打 Gateway，不经过任何一个应用的同源代理：这是夹具装配，
                   不是被测行为，走谁的代理都会给对照引入一条不对称的请求。

                   auth 关闭时 Gateway 用合成用户 `default` 应答，不需要注册也不需要
                   CSRF（实测：无 cookie 直接 POST 返回 200）。两个应用都跑在
                   auth 关闭模式下，因此看到的是同一个用户的同一份数据——
                   这正是「两边渲染的是同一条线程」的前提。

                   ⚠️ **种子不是完全确定的。** 实测后端会给这条线程补两个由播种时刻
                   决定的字段：AI 消息的 `additional_kwargs.turn_duration`，以及 run 的
                   `updated_at`。我们控制得了 `created_at` 与全部文本，控制不了这两个。
                   前者确实会上屏——两个应用都从它算运行耗时（React 的
                   core/messages/run-duration.ts 与 Vue 的同名文件读的是同一个字段）。

                   但它对**跨应用**比对无害，这是实测的，不是推断：种子只播一次，两个
                   应用读的是同一行，所以同一次运行里两边的耗时完全相同。topology.spec.ts
                   里「同一应用两次加载可访问性树相同」两边都绿，钉的就是这件事。
                   真正受影响的是**跨运行**：任何签入的截图或快照基线都必须把这两个
                   字段归一化，否则每次重播都会漂。
*/

import type { APIRequestContext } from "@playwright/test";

/** 固定 id：两个应用要打开同一条线程，不能各自随机生成。 */
export const FIXTURE_THREAD_ID = "parity-fixture-thread";

/** 足够特别的标记，避免和界面文案撞上。 */
export const FIRST_MARKER = "PARITY-FIRST-TURN-4a91c7";
export const SECOND_MARKER = "PARITY-SECOND-TURN-8d3f20";

export async function seedFixtureThread(
  request: APIRequestContext,
  gatewayUrl: string,
) {
  const response = await request.post(`${gatewayUrl}/api/test-only/seed-runs`, {
    data: {
      thread_id: FIXTURE_THREAD_ID,
      runs: [
        {
          run_id: `${FIXTURE_THREAD_ID}-r1`,
          created_at: "2026-01-01T00:00:00+00:00",
          messages: [
            {
              role: "human",
              content: FIRST_MARKER,
              id: `${FIXTURE_THREAD_ID}-r1-human`,
            },
            {
              role: "ai",
              content: `${FIRST_MARKER} reply`,
              id: `${FIXTURE_THREAD_ID}-r1-ai`,
            },
          ],
        },
        {
          run_id: `${FIXTURE_THREAD_ID}-r2`,
          created_at: "2026-01-01T00:01:00+00:00",
          messages: [
            {
              role: "human",
              content: SECOND_MARKER,
              id: `${FIXTURE_THREAD_ID}-r2-human`,
            },
            {
              role: "ai",
              content: `${SECOND_MARKER} reply`,
              id: `${FIXTURE_THREAD_ID}-r2-ai`,
            },
          ],
        },
      ],
    },
  });
  return response;
}
