/*
  【文件职责】     证明 Gateway 完全连不上时，登录与首次设置页仍然可用并能就地恢复。
  【架构位置】     E2E 认证 UI 合同（AUTH_DISABLED=0 构建）
  【主要导出】     无；Playwright cases
  【依赖关系】     app/layouts/auth.vue · app/pages/login.vue · app/pages/setup.vue
  【边界与注意】   React 侧有一个 `gateway-offline-fallback.tsx`，它解决的是
                   `(auth)` 布局在服务端探活失败时只剩一段裸 HTML、没有
                   AuthProvider/QueryClientProvider，用户不手动刷新就出不来的死锁。
                   Vue 的 auth 布局不做服务端探活，页面自己持有 setup 探测与重试，
                   所以那个死锁在结构上不存在——这条 spec 就是**把这句话变成机器证据**，
                   而不是靠「搜不到同名文件」下结论。

                   与 auth-setup-recovery.spec.ts 的区别：那条测的是 setup-status
                   返回 503（Gateway 活着但没准备好），这里测的是整个 `/api/**`
                   连接失败（Gateway 不在），并且额外断言恢复过程**没有整页重载**。

                   这两条用例在实现之前就应该是绿的。它们守的不是新功能，
                   而是「以后别把这条合法回退改坏」。
*/

import { expect, test, type Page } from "@playwright/test";

const UNAVAILABLE_TITLE = "Service temporarily unavailable";

/** 在页面上留一个只有整页重载才会消失的记号。 */
async function markPageInstance(page: Page) {
  await page.evaluate(() => {
    (
      globalThis as unknown as { __authPageInstance?: string }
    ).__authPageInstance = "kept";
  });
}

async function pageInstanceSurvived(page: Page) {
  return page.evaluate(
    () =>
      (globalThis as unknown as { __authPageInstance?: string })
        .__authPageInstance,
  );
}

/**
 * 先让每个 `/api/**` 请求连接失败，调用返回的 `recover()` 之后再放行。
 * `abort()` 而不是 5xx：Gateway 进程不在时浏览器看到的就是连接失败。
 */
async function unreachableGateway(page: Page) {
  let reachable = false;
  await page.route("**/api/**", (route) => {
    if (!reachable) return route.abort("connectionrefused");
    const url = route.request().url();
    if (url.includes("/auth/setup-status")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          needs_setup: false,
          registration_enabled: true,
        }),
      });
    }
    if (url.includes("/auth/providers")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ providers: [] }),
      });
    }
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Not authenticated" }),
    });
  });
  return () => {
    reachable = true;
  };
}

test.describe("auth pages with an unreachable Gateway", () => {
  test("keeps login usable and recovers in place", async ({ page }) => {
    const recover = await unreachableGateway(page);

    await page.goto("/login");

    // 关键点：页面**渲染出来了**，而且是完整的登录表单，不是一段静态提示。
    await expect(page.getByText(UNAVAILABLE_TITLE)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("textbox", { name: "Email" })).toBeEditable();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeEnabled();
    // 探测不出结果时不开放注册，这是 fail closed，不是页面坏了。
    await expect(
      page.getByRole("button", { name: /Don't have an account/i }),
    ).toHaveCount(0);

    const retry = page.getByRole("button", { name: "Try again" });
    await expect(retry).toBeEnabled();

    await markPageInstance(page);
    recover();
    await retry.click();

    await expect(page.getByText(UNAVAILABLE_TITLE)).toBeHidden();
    await expect(
      page.getByRole("button", { name: /Don't have an account/i }),
    ).toBeVisible();
    // 恢复不能靠用户自己按 F5——那正是 React 侧那个死锁的症状。
    expect(await pageInstanceSurvived(page)).toBe("kept");
  });

  test("keeps first-run setup recoverable without a reload", async ({
    page,
  }) => {
    let reachable = false;
    await page.route("**/api/**", (route) => {
      if (!reachable) return route.abort("connectionrefused");
      const url = route.request().url();
      if (url.includes("/auth/setup-status")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ needs_setup: true }),
        });
      }
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/setup");

    await expect(page.getByText(UNAVAILABLE_TITLE)).toBeVisible({
      timeout: 15_000,
    });
    const retry = page.getByRole("button", { name: "Try again" });
    await expect(retry).toBeEnabled();
    // 连不上 Gateway 时仍然留着一条离开这个页面的路。
    // 是 button 不是 link——React 用的是 `<Button onClick={router.replace}>`。
    // 这条断言原来写的是 link，把 Vue 当时的偏差钉成了正确行为：测试照着 Vue 的
    // 现状写，就只能证明 Vue 没变，证明不了它和 React 一样。
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();

    await markPageInstance(page);
    reachable = true;
    await retry.click();

    await expect(page.getByText(UNAVAILABLE_TITLE)).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Create Admin Account" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    expect(await pageInstanceSurvived(page)).toBe("kept");
  });
});
