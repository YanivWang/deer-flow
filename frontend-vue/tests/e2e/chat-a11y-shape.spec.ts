/*
  【文件职责】     钉住聊天页在可访问性树里的形状：谁有名字、谁是什么角色、谁不该出现。
  【架构位置】     产品合同套件（tests/e2e，自带 route mock）
  【主要导出】     无；Playwright 用例
  【边界与注意】   这些形状全部照 React 的实现对齐过一遍（对照结果由 e2e-parity 出）。
                   但 e2e-parity 需要兄弟应用 ../frontend 在 checkout 里，而本仓的常规
                   门禁不依赖它——所以对齐结果必须在**这里**再钉一份，否则一个只跑本仓
                   门禁的改动可以把它们逐条改回去而全绿。

                   钉的是角色与可访问名，不是 class、不是组件库内部结构。
*/

import { expect, test } from "@playwright/test";

import { handleRunStream, mockLangGraphAPI } from "./utils/mock-api";

type MockPage = Parameters<typeof mockLangGraphAPI>[0];

async function openNewChat(
  page: MockPage,
  extraRoutes?: (page: MockPage) => Promise<void>,
) {
  mockLangGraphAPI(page);
  await extraRoutes?.(page);
  await page.goto("/workspace/chats/new");
  await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible({
    timeout: 15_000,
  });
}

/*
  把 create 请求**扣住**，直到用例自己放行。

  夹具的 SSE 是一次性 fulfill 整个 body 的（metadata + values + end 一起到），
  于是 `creating -> streaming -> completed` 全发生在同一串微任务里，停止按钮只在
  一两帧里存在过。原来这条用例就靠那一两帧，机器忙的时候 Playwright 的第一次轮询
  已经晚于整条流跑完，断言拿到的是回到 `Submit` 的按钮，报的是「element(s) not
  found」——实测在一次满负载的 `make e2e` 里撞到过，单独重复 5 次全绿。

  换成扣住而不是 `setTimeout` 拖慢：拖慢只是把同一个窗口推后 250ms，机器足够忙时
  照样会飘，而且负向验证做不出来——把 `creating` 从 STREAMING_STATUSES 里删掉，
  用例仍然能靠后面那一两帧变绿（实测如此）。扣住之后窗口是无限长的，断言的对象也
  从「某一帧」变成了一条真合同：**create 还没回来时停止按钮就得在**。runner 的
  `onSessionState` 注释写的正是漏掉这一段的表现——慢连接下停止按钮永远不出现。
*/
function gateRunStream(page: MockPage) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const gated = async (route: Parameters<typeof handleRunStream>[0]) => {
    await gate;
    return handleRunStream(route);
  };
  return {
    install: async (target: MockPage) => {
      await target.route("**/api/langgraph/threads/*/runs/stream", gated);
      await target.route("**/api/langgraph/runs/stream", gated);
    },
    release: () => release(),
    page,
  };
}

test.describe("chat accessibility shape", () => {
  test("composer submit stays operable on an empty draft and turns into Stop while streaming", async ({
    page,
  }) => {
    const runStream = gateRunStream(page);
    await openNewChat(page, runStream.install);

    // 名字是写死的 "Submit"（React 的 PromptInputSubmit 不走词典），空草稿**不**禁用：
    // 禁用一个看得见的提交按钮，读屏器连它为什么按不动都说不出来。
    const submit = page.getByRole("button", { name: "Submit" });
    await expect(submit).toBeEnabled();
    await expect(page.getByRole("button", { name: "Send" })).toHaveCount(0);

    const textarea = page.getByPlaceholder(/how can i assist you/i);
    await textarea.fill("Draft a plan");
    await textarea.press("Enter");

    // 发送与停止是同一个按钮：换名字换图标，不换元素。
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({
      timeout: 20_000,
    });
    // create 还没回来——这就是 `creating` 段，不是流已经跑起来之后的某一帧。
    await expect(page.getByText("Hello from DeerFlow!")).toHaveCount(0);
    await expect(submit).toHaveCount(0);

    runStream.release();
    await expect(page.getByText("Hello from DeerFlow!")).toBeVisible({
      timeout: 20_000,
    });
    // 流结束后换回同一个按钮的 Submit 名字。
    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();
  });

  test("polish is disabled until the draft is something a model could rewrite", async ({
    page,
  }) => {
    await openNewChat(page);

    const polish = page.getByTestId("polish-input-button");
    await expect(polish).toBeDisabled();

    const textarea = page.getByPlaceholder(/how can i assist you/i);
    await textarea.fill("/compact");
    await expect(polish).toBeDisabled();

    await textarea.fill("summarise the release notes");
    await expect(polish).toBeEnabled();
  });

  test("welcome greeting reads the wave with the words", async ({ page }) => {
    await openNewChat(page);

    // 👋 不是 aria-hidden 的装饰：React 把它当正文，读屏器读到的是「👋 Hello, again!」。
    // 断言走可访问性树而不是 DOM 文本：问候语被 AuroraText 拆成了多个元素，
    // 「屏幕上连起来读是什么」只有这棵树答得准。
    await expect
      .poll(() => page.locator("body").ariaSnapshot())
      .toContain("👋 Hello, again!");
  });

  test("the conversation log is unnamed and the transcript is not a list", async ({
    page,
  }) => {
    await openNewChat(page);

    const log = page.getByRole("log");
    await expect(log).toHaveCount(1);
    await expect(log).not.toHaveAttribute("aria-label", /.*/);
    // 消息流是 div：一段对话不是一份清单，读屏器不该报「共 N 项」。
    await expect(page.locator('[data-testid="message-list"]')).toHaveJSProperty(
      "tagName",
      "DIV",
    );
  });

  test("context usage announces itself before there is any usage to show", async ({
    page,
  }) => {
    await openNewChat(page);

    await expect(
      page.locator('[data-context-usage-placeholder="true"]'),
    ).toHaveAttribute("role", "status");
  });

  test("the toast viewport exists before the first toast does", async ({
    page,
  }) => {
    await openNewChat(page);

    // 常驻的 live region 是新 toast 能被播报的前提；列表本身按需出现。
    await expect(
      page.getByRole("region", { name: "Notifications alt+T" }),
    ).toHaveCount(1);
    await expect(page.locator('[data-testid="workspace-toaster"]')).toHaveCount(
      0,
    );
  });

  test("the sidebar is menus and list items, not landmarks", async ({
    page,
  }) => {
    await openNewChat(page);

    const sidebar = page.locator("#workspace-sidebar");
    await expect(sidebar).toHaveJSProperty("tagName", "DIV");
    await expect(sidebar.locator("nav")).toHaveCount(0);
    for (const name of ["New chat", "Chats", "Agents", "Scheduled tasks"]) {
      await expect(
        sidebar.locator('[data-sidebar="menu-item"]', {
          has: page.getByRole("link", { name, exact: true }),
        }),
      ).toHaveCount(1);
    }

    // 一条会话都没有时，「最近的对话」整块不渲染——空标题加空列表会被读出来。
    await expect(sidebar.getByText("Recent chats")).toHaveCount(0);
  });
});
