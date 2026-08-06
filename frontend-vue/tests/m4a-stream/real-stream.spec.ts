/*
  【文件职责】     M4a 的**真流** gate：分块到达、心跳、Last-Event-ID 续传、gap→A7。
  【对应 frontend/】 无；补的是共享合同在 M4b 之前覆盖不到的一段
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     tests/support/stream-gateway.mjs（经 Nuxt 代理）
  【边界与注意】   与 `tests/m4a/chat-dataflow.spec.ts` 的分工：那份用
                   `route.fulfill` 一次性给完整 body，验的是**归并与顺序**；
                   本份让浏览器真的从 socket 上一片一片读，验的是**只有分块到达
                   才会暴露的东西**。两份都要，因为前者跑得快、后者才有真实性。

                   请求**不被拦截**（除了改写 query 选脚本），流是浏览器自己从
                   Nitro 代理读的——这一点是本文件的全部意义，不要为了方便改成
                   `route.fulfill`。
*/

import { expect, test, type Page } from "@playwright/test";

/** 让这一条用例的 create 走假 Gateway 的哪个脚本。用改写 URL 而不是 fulfill：
 *  `route.continue()` 由浏览器真正发出请求，响应体仍然是流式的。 */
async function useScript(page: Page, script: "plain" | "gap") {
  await page.route("**/api/langgraph/threads/*/runs/stream*", (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set("script", script);
    return route.continue({ url: url.toString() });
  });
}

async function openNewChat(page: Page) {
  await page.goto("/workspace/chats/new");
  const textarea = page.getByPlaceholder(/how can i assist you/i);
  await expect(textarea).toBeVisible({ timeout: 20_000 });
  return textarea;
}

test.describe("M4a 真流 gate", () => {
  test("逐片 delta 在浏览器里拼成完整答案，顺序仍然是 human 在前", async ({
    page,
  }) => {
    await useScript(page, "plain");
    const textarea = await openNewChat(page);
    await textarea.fill("Build a deck");
    await textarea.press("Enter");

    const items = page.locator('[data-testid="message-list"] li');
    await expect(items).toHaveCount(2, { timeout: 20_000 });
    // 正面特征：**五片拼起来的全文**。任何一片被覆盖而不是追加，
    // 这里都会拿到一个截断的字符串，而截断的字符串同样「非空」。
    await expect(items.nth(1)).toHaveText("Hello from DeerFlow!", {
      timeout: 20_000,
    });
    await expect(items.nth(0)).toHaveAttribute("data-role", "human");
    await expect(items.nth(1)).toHaveAttribute("data-role", "ai");
  });

  test("心跳注释帧不进消息列表", async ({ page }) => {
    await useScript(page, "plain");
    const textarea = await openNewChat(page);
    await textarea.fill("Build a deck");
    await textarea.press("Enter");

    const items = page.locator('[data-testid="message-list"] li');
    await expect(items).toHaveCount(2, { timeout: 20_000 });
    // 假 Gateway 在**每一片之前**都发一条 `: keep-alive`。它必须在传输层
    // 就被吃掉（05 L9）；漏进 reducer 会多出若干条空消息。
    await expect(items).toHaveCount(2);
    await expect(page.locator("text=keep-alive")).toHaveCount(0);
  });

  test("gap：带 Last-Event-ID 续传，并触发 A7 的清空与本地化警告", async ({
    page,
  }) => {
    await useScript(page, "gap");
    const textarea = await openNewChat(page);
    await textarea.fill("Build a deck");
    await textarea.press("Enter");

    // A7 的第一条正面特征：**用户看得见的本地化文案**，不是一个 key。
    const warning = page.getByRole("status");
    await expect(warning).toBeVisible({ timeout: 20_000 });
    await expect(warning).toHaveText(
      "Some live updates expired. The conversation was restored from saved state.",
      { timeout: 20_000 },
    );

    // 第二条：续传**真的带了游标**。假 Gateway 把收到的 Last-Event-ID
    // 回显成一条消息；拿到 `resumed@none` 就说明是从头重放而不是续传。
    const items = page.locator('[data-testid="message-list"] li');
    await expect(items.filter({ hasText: "resumed@e8" })).toHaveCount(1, {
      timeout: 20_000,
    });
  });
});
