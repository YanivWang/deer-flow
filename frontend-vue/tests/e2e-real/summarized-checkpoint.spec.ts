/*
  【文件职责】     压缩过的线程：checkpoint 的消息副本必须盖过事件库里的旧原文。
  【架构位置】     E2E（真 Gateway，无模型、无录制、无 API key）
  【主要导出】     无
  【依赖关系】     backend/scripts/run_replay_gateway.py 的 /api/test-only/seed-runs
                   与 POST /api/threads/{id}/state · app/composables/useThreadStream.ts
  【边界与注意】   **这条差异台账测不到，所以只能在这里守。** 对照套件的默认夹具里
                   `/history` 与 `/messages/page` 返回的是同一批消息，两条取数路径
                   的差异因此永远不上屏；要看见它必须专门造出「两边不一致」的后端
                   状态——这正是上下文压缩之后的常态：checkpoint 持有压缩后的副本，
                   事件库仍然持有当时流出去的原文。

                   夹具由三步拼出来，缺一步都测不到东西：
                   1. `POST /api/threads` 先把线程建出来——`POST /{id}/state` 带
                      `require_existing=True`，只 seed-runs 的线程会 404
                      （seed-runs 写的是 run store + 事件库，**故意不写 checkpoint**，
                      文件头明写 "No checkpoint is written: that is the whole point"）。
                   2. `seed-runs` 写原文进事件库。
                   3. `POST /{id}/state` 写 checkpoint：`messages` 在
                      `THREAD_STATE_REDUCER_FIELDS` 里，后端按 `Overwrite` 处理，
                      于是这一批就是 checkpoint 的全部消息。

                   断言里「RAW answer 不可见」是本用例的核心。只断言
                   「COMPRESSED answer 可见」是假绿：种子没接上时页面同样能显示
                   一堆内容（事件库那份），而两份内容同时出现也算「可见」。
*/
import { expect, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3101";

const RAW_QUESTION = "RAW-QUESTION-3f7c1a";
const RAW_ANSWER = "RAW-ANSWER-8be402";
const COMPRESSED_ANSWER = "COMPRESSED-ANSWER-51d9c7";
const CHECKPOINT_ONLY = "CHECKPOINT-ONLY-TAIL-2a6f88";

test.describe("summarized checkpoint overrides the event journal", () => {
  test("checkpoint copy replaces the raw message and its tail renders", async ({
    page,
    context,
  }) => {
    const uniq = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const threadId = `e2e-summarized-${uniq}`;
    const email = `e2e-${uniq}@example.com`;
    const humanId = `${threadId}-h`;
    const aiId = `${threadId}-a`;

    const reg = await context.request.post(`${APP}/api/v1/auth/register`, {
      data: { email, password: "very-strong-password-123" },
    });
    expect(reg.status(), await reg.text()).toBe(201);
    const cookies = await context.cookies();
    const csrf = cookies.find((c) => c.name === "csrf_token")?.value;
    expect(csrf, "register must set csrf_token cookie").toBeTruthy();
    const headers = { "X-CSRF-Token": csrf! };

    // 1. 线程先存在，否则 POST /state 会因为 require_existing 直接 404。
    const created = await context.request.post(`${APP}/api/threads`, {
      headers,
      data: { thread_id: threadId },
    });
    expect(created.status(), await created.text()).toBe(200);

    // 2. 事件库里的原文——用户当时真的看到过的那一版。
    const seed = await context.request.post(`${APP}/api/test-only/seed-runs`, {
      headers,
      data: {
        thread_id: threadId,
        runs: [
          {
            run_id: `${threadId}-r1`,
            created_at: "2026-01-01T00:00:00+00:00",
            messages: [
              { role: "human", content: RAW_QUESTION, id: humanId },
              { role: "ai", content: RAW_ANSWER, id: aiId },
            ],
          },
        ],
      },
    });
    expect(seed.status(), await seed.text()).toBe(200);

    // 3. checkpoint：同一个 ai 消息 id，内容已经被压缩过，另外多一条只有
    //    checkpoint 才有的尾巴。这两件事分别打中归并里的「同身份替换」与
    //    「最后一个锚点之后的 live-only 段」。
    const state = await context.request.post(
      `${APP}/api/threads/${encodeURIComponent(threadId)}/state`,
      {
        headers,
        data: {
          values: {
            messages: [
              { type: "human", id: humanId, content: RAW_QUESTION },
              { type: "ai", id: aiId, content: COMPRESSED_ANSWER },
              {
                type: "ai",
                id: `${threadId}-tail`,
                content: CHECKPOINT_ONLY,
              },
            ],
          },
        },
      },
    );
    expect(state.status(), await state.text()).toBe(200);

    // 前置条件本身要证明，而不是假设：两条路径现在必须**不一致**。
    const page1 = await context.request.get(
      `${APP}/api/threads/${encodeURIComponent(threadId)}/messages/page`,
    );
    expect(page1.status(), await page1.text()).toBe(200);
    expect(await page1.text()).toContain(RAW_ANSWER);
    expect(await page1.text()).not.toContain(COMPRESSED_ANSWER);

    const history = await context.request.post(
      `${APP}/api/langgraph/threads/${encodeURIComponent(threadId)}/history`,
      { headers, data: { limit: 1 } },
    );
    expect(history.status(), await history.text()).toBe(200);
    const historyText = await history.text();
    expect(historyText).toContain(COMPRESSED_ANSWER);
    expect(historyText).not.toContain(RAW_ANSWER);

    await page.goto(`/workspace/chats/${threadId}`);

    await expect(page.getByText(RAW_QUESTION, { exact: false })).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByText(COMPRESSED_ANSWER, { exact: false }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText(CHECKPOINT_ONLY, { exact: false }),
    ).toBeVisible();
    // 核心断言：事件库那份旧原文必须**不**上屏。没有 checkpoint 种子时
    // 这里是可见的，而 COMPRESSED_ANSWER 一个字都不会出现。
    await expect(page.getByText(RAW_ANSWER, { exact: false })).toHaveCount(0);
  });
});
