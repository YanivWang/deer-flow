import { expect, test } from "@playwright/test";

import { MOCK_THREAD_ID, mockLangGraphAPI } from "./utils/mock-api";

test.describe("Browser feature flag", () => {
  test("shows browser trigger only when browser_control is enabled", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      threads: [{ thread_id: MOCK_THREAD_ID, title: "Browser Enabled" }],
    });

    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);

    await expect(page.getByTestId("browser-trigger")).toBeVisible({
      timeout: 15_000,
    });
  });

  /*
    入口是 `<Button size="icon" variant="ghost">`，不是手搓的 `<button class="size-8">`。

    这条钉的是**结构的产物**：`size-9`（36×36）与 button base 的 `text-sm`（14px）。
    此前那版手写按钮是 32×32、字号继承成 16px，跨应用对照上因此有三条几何差；
    照着数字把 `size-8` 改成 `size-9` 能对上两个数，字号还是差的——所以判据必须是
    「用了同一个 primitive」，量出来的三个值只是它的影子。
  */
  test("the browser trigger is the shared icon button, not a hand-rolled one", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      threads: [{ thread_id: MOCK_THREAD_ID, title: "Browser Enabled" }],
    });
    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);

    const trigger = page.getByTestId("browser-trigger");
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    const box = await trigger.boundingBox();
    expect(box?.width).toBe(36);
    expect(box?.height).toBe(36);
    expect(
      await trigger.evaluate((node) => getComputedStyle(node).fontSize),
    ).toBe("14px");
    // 关闭态的名字来自 `common.showBrowser`，与上游同键。
    await expect(trigger).toHaveAttribute("aria-label", "Open browser panel");
    // 上游把它包在 Tooltip 里（`asChild` 触发器，不额外产生 DOM 节点）。
    await expect(trigger).toHaveAttribute("data-slot", "tooltip-trigger");
  });

  test("hides browser trigger when browser_control is disabled", async ({
    page,
  }) => {
    mockLangGraphAPI(page, {
      threads: [{ thread_id: MOCK_THREAD_ID, title: "Browser Disabled" }],
      features: { browserControlEnabled: false },
    });

    const featuresResponse = page.waitForResponse((response) =>
      response.url().includes("/api/features"),
    );
    await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);
    const features = (await (await featuresResponse).json()) as {
      browser_control?: { enabled?: boolean };
    };
    expect(features.browser_control?.enabled).toBe(false);

    await expect(page.getByTestId("browser-trigger")).toHaveCount(0);
  });
});
