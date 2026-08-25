/*
  【文件职责】     钉住「checkpoint 缺失不等于线程不存在」这条路由合同。
  【架构位置】     E2E 产品合同（mock Gateway）
  【主要导出】     Playwright scenarios
  【依赖关系】     tests/e2e/utils/mock-api · AgentChat 的线程存在性探测
  【边界与注意】   上下文压缩之后 checkpoint 不再持有旧消息，`GET /threads/{id}` 与
                   `/state` 双双 404，而 `/threads/{id}/messages/page` 仍然完整返回
                   这段会话。以前这里是「404 就跳回新会话」，用户看到的是对话凭空
                   消失。真实后端的端到端确认在 tests/e2e-real/multi-run-order.spec.ts，
                   这里用 mock 把同一条判据钉在 e2e-mock 里，让它进得了 CI。
*/

import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI, MOCK_THREAD_ID } from "./utils/mock-api";

const ALPHA = "ALPHA-FIRST-QUESTION-7f3a2c";
const OMEGA = "OMEGA-SECOND-QUESTION-9b21d4";

/** 让 checkpoint 相关的两个端点按给定状态码失败，历史端点保持不动。 */
async function failThreadCheckpoint(page: Page, status: number) {
  const fail = (route: Parameters<Parameters<Page["route"]>[1]>[0]) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ detail: "no checkpoint" }),
    });
  await page.route("**/api/langgraph/threads/*/state", fail);
  await page.route("**/api/langgraph/threads/*", (route) =>
    // `**/api/langgraph/threads/*` 也会命中 `/search`，那条必须放行，
    // 否则侧栏列表一起挂掉，测的就不是本用例要测的东西了。
    route.request().url().endsWith("/search") ? route.fallback() : fail(route),
  );
}

test("a thread whose checkpoint is gone still renders its conversation", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: MOCK_THREAD_ID,
        title: "Compacted thread",
        messages: [
          { type: "human", id: "a-h", content: ALPHA },
          { type: "ai", id: "a-a", content: "ALPHA reply" },
          { type: "human", id: "o-h", content: OMEGA },
          { type: "ai", id: "o-a", content: "OMEGA reply" },
        ],
      },
    ],
  });
  await failThreadCheckpoint(page, 404);

  await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);

  const alpha = page.getByText(ALPHA, { exact: false });
  const omega = page.getByText(OMEGA, { exact: false });
  await expect(alpha).toBeVisible({ timeout: 15_000 });
  await expect(omega).toBeVisible();

  // 留在原地：以前这里会被静默送到 /workspace/chats/new。
  await expect(page).toHaveURL(
    new RegExp(`/workspace/chats/${MOCK_THREAD_ID}`),
  );

  // 顺带钉住时间顺序：历史端点按 seq 正序返回，渲染就该是正序。
  const alphaBox = await alpha.first().boundingBox();
  const omegaBox = await omega.first().boundingBox();
  expect(alphaBox!.y).toBeLessThan(omegaBox!.y);
});

test("a thread that is really gone still falls back to a new chat", async ({
  page,
}) => {
  mockLangGraphAPI(page, { threads: [] });
  await failThreadCheckpoint(page, 404);

  await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);

  // 元数据缺失 + 历史问完了也确实是空的 —— 这才是该放弃这个 URL 的情况。
  await expect(page).toHaveURL(/\/workspace\/chats\/new/, { timeout: 15_000 });
});

test("a transient probe failure never throws the user out of the thread", async ({
  page,
}) => {
  // 空历史 + 5xx：只要错误不是 403/404，就不能当成「线程不存在」。
  // 少了这条判据，一次瞬时故障就会把用户连人带对话踢回新会话。
  mockLangGraphAPI(page, { threads: [] });
  await failThreadCheckpoint(page, 503);

  await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
  await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(1_000);

  await expect(page).toHaveURL(
    new RegExp(`/workspace/chats/${MOCK_THREAD_ID}`),
  );
});
