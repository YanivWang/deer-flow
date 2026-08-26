import { type Locator, type Page, expect, test } from "@playwright/test";

import { mockLangGraphAPI } from "./utils/mock-api";

const ARTIFACT_PATH = "/artifact-fixtures/report.html";
const THREAD_ID = "00000000-0000-0000-0000-000000003125";

function writeFileMessages() {
  return [
    {
      type: "human",
      id: "msg-human-artifact",
      content: [{ type: "text", text: "Create a report artifact" }],
    },
    {
      type: "ai",
      id: "msg-ai-write-artifact",
      content: "",
      tool_calls: [
        {
          id: "write-file-artifact",
          name: "write_file",
          args: {
            description: "Writing report artifact",
            path: ARTIFACT_PATH,
            content:
              "<!doctype html><html><body><h1>Report draft</h1></body></html>",
          },
        },
      ],
    },
    {
      type: "tool",
      id: "msg-tool-write-artifact",
      name: "write_file",
      tool_call_id: "write-file-artifact",
      content: "OK",
    },
  ];
}

async function panelWidth(panel: Locator): Promise<number> {
  return (await panel.boundingBox())?.width ?? 0;
}

async function dragPanel(handle: Locator, ...deltas: number[]): Promise<void> {
  await handle.hover();
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  const mouse = handle.page().mouse;
  await mouse.down();
  let currentX = x;
  for (const delta of deltas) {
    currentX += delta;
    await mouse.move(currentX, y, { steps: 10 });
  }
  await mouse.up();
}

async function ensureArtifactOpen(page: Page): Promise<Locator> {
  const path = page.getByText(ARTIFACT_PATH);
  await expect(path).toBeVisible({ timeout: 15_000 });
  const panel = page.locator("#artifacts");
  if (!(await panel.isVisible())) await path.click();
  await expect(panel).toBeVisible();
  return panel;
}

test.describe("Vue artifacts panel resize", () => {
  test.beforeEach(async ({ page }) => {
    mockLangGraphAPI(page, {
      threads: [
        {
          thread_id: THREAD_ID,
          title: "Artifact panel resize",
          messages: writeFileMessages(),
        },
      ],
    });
    await page.goto(`/workspace/chats/${THREAD_ID}`);
  });

  test("the splitpanes separator resizes the artifacts panel", async ({
    page,
  }) => {
    const panel = await ensureArtifactOpen(page);
    const separator = page.getByRole("separator");
    await expect(separator).toBeVisible();
    await expect(separator).toHaveAttribute("aria-orientation", "vertical");

    const widthBefore = await panelWidth(panel);
    await dragPanel(separator, -200);
    await expect
      .poll(() => panelWidth(panel))
      .toBeGreaterThan(widthBefore + 100);
  });

  test("drag-collapse closes the panel and selecting the artifact reopens it", async ({
    page,
  }) => {
    const panel = await ensureArtifactOpen(page);
    const separator = page.getByRole("separator");
    await dragPanel(separator, 500);

    await expect(panel).toBeHidden();
    // 关掉之后分隔线**留在树里**并标 disabled（与 React 的 ResizableHandle 一致），
    // 只是画不出来也拖不动；把它整个摘掉，读屏器就再也说不出这里本来有一条分隔线。
    await expect(separator).toHaveAttribute("aria-disabled", "true");
    await expect(separator).toHaveCSS("opacity", "0");
    await page.getByText(ARTIFACT_PATH).click();
    await expect(panel).toBeVisible();

    const groupWidth = await panelWidth(page.locator(".workspace-panels"));
    await expect
      .poll(() => panelWidth(panel))
      .toBeGreaterThan(groupWidth * 0.19);
  });

  test("reversing a collapse drag before release keeps the panel open", async ({
    page,
  }) => {
    const panel = await ensureArtifactOpen(page);
    const separator = page.getByRole("separator");
    await dragPanel(separator, 500, -500);

    await expect(panel).toBeVisible();
    await expect(panel.getByText("report.html")).toBeVisible();
    await expect(separator).toBeVisible();
    await expect(separator).not.toHaveAttribute("aria-disabled", "true");
  });

  test("a released width is kept when the panel is reopened", async ({
    page,
  }) => {
    const panel = await ensureArtifactOpen(page);
    const separator = page.getByRole("separator");
    const widthBefore = await panelWidth(panel);
    await dragPanel(separator, -200);
    await expect
      .poll(() => panelWidth(panel))
      .toBeGreaterThan(widthBefore + 100);
    const widthAfterDrag = await panelWidth(panel);

    await panel.getByRole("button", { name: /close/i }).first().click();
    await expect(panel).toBeHidden();
    await page.getByText(ARTIFACT_PATH).click();
    await expect(panel).toBeVisible();
    await expect
      .poll(() => panelWidth(panel))
      .toBeGreaterThan(widthAfterDrag - 20);
  });

  test("history auto-opens the artifact and native splitpanes keyboard resizing works", async ({
    page,
  }) => {
    const panel = page.locator("#artifacts");
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText("report.html")).toBeVisible();

    const separator = page.getByRole("separator");
    const widthBefore = await panelWidth(panel);
    await separator.focus();
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => panelWidth(panel)).toBeGreaterThan(widthBefore);
    await expect(separator).toBeFocused();
  });
});
