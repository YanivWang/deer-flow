/*
  【文件职责】     在真实浏览器中验证 auth 关闭时 workspace 路由不会被弹去登录页。
  【架构位置】     测试
  【主要导出】     @auth-disabled case
  【依赖关系】     使用 Nuxt preview（NUXT_PUBLIC_AUTH_DISABLED=1）
  【边界与注意】   这条断言的是**路由准入**，不是登录本身——真实 Cookie/CSRF 门禁由
                   e2e-auth 套件负责。
                   原来它找的是 `[data-m0-workspace]`：那是 `/workspace` 还是占位页时
                   的标记。`/workspace` 改成固定 replace 到 `/workspace/chats/new` 之后
                   那个标记就被删了，而这条用例没跟着改，于是一直红着没人看见
                   （旧的 e2e-m0 从没在 CI 里跑过）。现在钉的是当前的真实落点。
*/

import { expect, test } from "@playwright/test";

test("@auth-disabled opens the workspace shell without redirecting", async ({
  page,
}) => {
  await page.goto("/workspace");

  // 落在默认新聊天页，而不是 /login。
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
  await expect(page.locator("#workspace-sidebar")).toBeVisible();
});
