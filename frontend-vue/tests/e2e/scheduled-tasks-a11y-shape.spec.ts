/*
  【文件职责】     钉住 scheduled-task 页在可访问性树上的**形状**：控件类型、可访问名、
                   标题层级与页面外壳。
  【架构位置】     Playwright contract（Vue-owned）
  【主要导出】     Playwright scenarios
  【依赖关系】     shared mock Gateway · Vue scheduled-task page/components
  【边界与注意】   这些形状本来由 e2e-parity 逐行比出来，但那套件要兄弟 React 应用
                   （`../frontend`）才能跑，本模块的常规门禁不依赖它。做法同
                   thread-list-a11y-shape / chat-a11y-shape：把对照出来的结论在不需要
                   兄弟应用的地方再钉一份。

                   每条断言旁边写的是 React 的出处，因为「为什么是这个形状」只有在
                   那边才成立——脱离对照看，好几条（比如详情不用 `<dl>`、时区 combobox
                   没有可访问名）单独看都像是退步。
*/
import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI } from "./utils/mock-api";

const TASK = {
  id: "task-1",
  thread_id: "thread-1",
  context_mode: "reuse_thread" as const,
  last_thread_id: null,
  title: "Daily summary",
  prompt: "Summarize thread",
  schedule_type: "cron" as const,
  schedule_spec: { cron: "0 9 * * *" },
  timezone: "UTC",
  status: "enabled" as const,
  next_run_at: "2026-07-02T01:00:00+00:00",
  last_run_at: null,
  last_run_id: null,
  last_error: null,
  run_count: 0,
  created_at: "2026-07-01T00:00:00+00:00",
  updated_at: "2026-07-01T00:00:00+00:00",
};

async function open(page: Page) {
  mockLangGraphAPI(page, { threads: [], scheduledTasks: [TASK] });
  await page.goto("/workspace/scheduled-tasks");
  await expect(
    page.getByRole("button", { name: /Daily summary/i }),
  ).toBeVisible();
}

async function choosePreset(page: Page, option: string) {
  await page.getByTestId("schedule-preset").click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test.describe("scheduled tasks a11y shape", () => {
  test("the page sits in the workspace shell, not on a bare section", async ({
    page,
  }) => {
    await open(page);
    // React 的这一页在 WorkspaceContainer/Header/Body 三件套里。
    const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
    await expect(
      breadcrumb.getByRole("link", { name: "Workspace" }),
    ).toHaveAttribute("href", "/workspace");
    await expect(
      breadcrumb.getByRole("link", { name: "Scheduled-tasks" }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(2);
    await expect(
      page.getByRole("heading", { level: 1, name: "Scheduled tasks" }),
    ).toBeVisible();
    // 列表页没有 h1 以外的标题；「创建定时任务」「0 runs」都是普通文本。
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(0);
    await expect(page).toHaveTitle("Scheduled tasks - DeerFlow");
  });

  test("the create form is placeholders and buttons, not labels and selects", async ({
    page,
  }) => {
    await open(page);
    const form = page.getByTestId("scheduled-task-create-form");

    // recipe 的可访问名只有标题：emoji 是 aria-hidden，描述不在按钮里。
    await expect(
      form.getByRole("button", { name: "Daily tech news digest", exact: true }),
    ).toBeVisible();
    // emoji 仍然看得见，但它挂着 aria-hidden，所以不进可访问名。
    await expect(form.getByText("📰", { exact: true })).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(
      form.getByText("Collect and summarize the day's top tech news"),
    ).toHaveCount(0);

    // context mode 是两颗按钮。
    await expect(
      form.getByRole("button", { name: "Fresh thread", exact: true }),
    ).toBeVisible();
    await expect(
      form.getByRole("button", { name: "Reuse thread", exact: true }),
    ).toBeVisible();
    await expect(
      form.getByRole("combobox", { name: "Context mode" }),
    ).toHaveCount(0);

    // 输入框只有 placeholder，树上不多一个 text 节点。
    await expect(
      form.getByRole("textbox", { name: "Task title" }),
    ).toBeVisible();
    await expect(form.getByText("Task title", { exact: true })).toHaveCount(0);

    // 必填项没填满时 Create 是禁用的。
    await expect(form.getByRole("button", { name: "Create" })).toBeDisabled();
    await form.getByTestId("scheduled-task-title").fill("t");
    await form.getByTestId("scheduled-task-prompt").fill("p");
    await expect(form.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  test("the schedule input uses a time picker and toggle buttons", async ({
    page,
  }) => {
    await open(page);
    const form = page.getByTestId("scheduled-task-create-form");

    // daily：一个 type=time，不是「小时」+「分钟」两个 spinbutton。
    await expect(form.getByRole("textbox", { name: "Time" })).toHaveValue(
      "09:00",
    );
    await expect(form.getByRole("spinbutton", { name: "Time" })).toHaveCount(0);
    await expect(form.getByRole("spinbutton", { name: "Minute" })).toHaveCount(
      0,
    );

    // preset 是 combobox（Reka Select），不是原生 select。
    const preset = form.getByRole("combobox").first();
    await expect(preset).toHaveText("Daily");
    // 关着的时候选项不在树上。
    await expect(form.getByRole("option")).toHaveCount(0);

    // hourly：只剩分钟一个数字输入。
    await choosePreset(page, "Hourly");
    await expect(
      form.getByRole("spinbutton", { name: "Minute" }),
    ).toBeVisible();
    await expect(form.getByRole("textbox", { name: "Time" })).toHaveCount(0);

    // weekly：一排 aria-pressed 的切换按钮，不是复选框；最后一天取消不掉。
    await choosePreset(page, "Weekly");
    await expect(form.getByRole("checkbox")).toHaveCount(0);
    const monday = form.getByRole("button", { name: "Mon", exact: true });
    await expect(monday).toHaveAttribute("aria-pressed", "true");
    await monday.click();
    await expect(monday).toHaveAttribute("aria-pressed", "true");
    await form.getByRole("button", { name: "Wed", exact: true }).click();
    await monday.click();
    await expect(monday).toHaveAttribute("aria-pressed", "false");

    // monthly：几号的数字输入。
    await choosePreset(page, "Monthly");
    await expect(
      form.getByRole("spinbutton", { name: "Day of month" }),
    ).toHaveValue("1");

    // custom：cron 文本框 + crontab.guru 外链。
    await choosePreset(page, "Custom cron");
    await expect(
      form.getByRole("textbox", { name: "Cron expression" }),
    ).toBeVisible();
    await expect(
      form.getByRole("link", { name: /crontab\.guru/ }),
    ).toHaveAttribute("href", "https://crontab.guru/");

    // 预览是一句裸文本，前面没有「Preview:」。
    await expect(form.getByTestId("schedule-preview")).not.toContainText(
      "Preview",
    );
  });

  test("the timezone combobox has no accessible name, matching React", async ({
    page,
  }) => {
    await open(page);
    const form = page.getByTestId("scheduled-task-create-form");
    /*
      React 的 SelectTrigger 上没有 aria-label 也没有关联 label，于是树上是一个匿名的
      combobox。补一个名字听起来更好，但那样两个应用念出来的不一样。
    */
    await expect(form.getByRole("combobox")).toHaveCount(2);
    await expect(form.getByRole("combobox", { name: "Timezone" })).toHaveCount(
      0,
    );
  });

  test("one-time swaps the whole cron block for a datetime input", async ({
    page,
  }) => {
    await open(page);
    const form = page.getByTestId("scheduled-task-create-form");
    await form.getByRole("button", { name: "One-time" }).click();
    await expect(form.getByTestId("scheduled-task-run-at")).toBeVisible();
    await expect(form.getByTestId("schedule-preset")).toHaveCount(0);
    await expect(form.getByRole("textbox", { name: "Time" })).toHaveCount(0);
  });

  test("the detail pane is flat text, and the list row omits the timezone", async ({
    page,
  }) => {
    await open(page);
    const detail = page.getByTestId("scheduled-task-detail");

    // React 的详情是一行行 `标签: 值` 的普通 div，不是定义列表。
    await expect(detail.locator("dl")).toHaveCount(0);
    await expect(detail.locator("dt")).toHaveCount(0);
    // reuse_thread 显示 Thread，不显示 Last thread；Timezone / Run count 都不显示。
    await expect(detail).toContainText("Thread: thread-1");
    await expect(detail).not.toContainText("Last thread");
    await expect(detail).not.toContainText("Timezone");
    await expect(detail).not.toContainText("Run count");
    // Schedule 显示的是类型，不是 cron 描述。
    await expect(detail).toContainText("Schedule: Recurring");
    await expect(detail).not.toContainText("Schedule: Every day");
    // last_error 为空也照样显示一行 `—`。
    await expect(detail).toContainText("Last error: —");

    // 列表行是「标题 + 类型 · 状态」，没有时区。
    await expect(
      page.getByRole("button", { name: "Daily summary Recurring · Enabled" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Daily summary.*UTC/ }),
    ).toHaveCount(0);
  });

  test("the delete confirm is a dialog with React's title and description", async ({
    page,
  }) => {
    await open(page);
    await page.getByTestId("scheduled-task-delete").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // React 用的是 Dialog 而不是 AlertDialog：role 是 dialog，不是 alertdialog。
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(dialog).toContainText("Delete");
    await expect(dialog).toContainText("cannot be undone");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
  });
});
