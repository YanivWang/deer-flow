import { expect, test } from "@playwright/test";

import { mockLangGraphAPI } from "./utils/mock-api";

test.describe("Landing page", () => {
  test("renders the header and hero section", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.locator("header").first().getByText("DeerFlow", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toContainText("DeerFlow");

    // "Get Started" call-to-action button in hero
    await expect(
      page.getByRole("link", { name: /get started/i }),
    ).toBeVisible();
  });

  for (const width of [320, 375, 390]) {
    test(`does not overflow at ${width}px width`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/");

      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      await expect(page.locator("main").first()).toBeInViewport();
    });
  }

  test("centers width-constrained sections on wide screens", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");

    for (const title of ["Case Studies", "Agent Runtime Environment"]) {
      const section = page
        .locator("section")
        .filter({ has: page.getByText(title, { exact: true }) });
      const content = section.locator(":scope > main > div");
      const [sectionBox, contentBox] = await Promise.all([
        section.boundingBox(),
        content.boundingBox(),
      ]);

      expect(sectionBox).not.toBeNull();
      expect(contentBox).not.toBeNull();
      expect(
        Math.abs(
          sectionBox!.x +
            sectionBox!.width / 2 -
            (contentBox!.x + contentBox!.width / 2),
        ),
      ).toBeLessThanOrEqual(1);
    }
  });

  test("keeps the centered skills playback control below the animation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");

    const section = page
      .locator("section")
      .filter({ has: page.getByText("Agent Skills", { exact: true }) });
    // This section contains a deliberately continuous animation. Scrolling is
    // setup for a geometry assertion, so invoke the DOM scroll primitive
    // directly instead of asking an actionability check to wait for the
    // animated subtree to become stable.
    await section.evaluate((element) =>
      element.scrollIntoView({ block: "center" }),
    );

    const control = section
      .getByText(/Click to (pause|play)/, { exact: true })
      .last()
      .locator("..");
    const animation = section.locator(".max-w-6xl");
    await expect(control).toBeVisible();

    const [sectionBox, controlBox, animationBox] = await Promise.all([
      section.boundingBox(),
      control.boundingBox(),
      animation.boundingBox(),
    ]);

    expect(sectionBox).not.toBeNull();
    expect(controlBox).not.toBeNull();
    expect(animationBox).not.toBeNull();
    expect(
      Math.abs(
        sectionBox!.x +
          sectionBox!.width / 2 -
          (controlBox!.x + controlBox!.width / 2),
      ),
    ).toBeLessThanOrEqual(1);
    expect(
      controlBox!.y - (animationBox!.y + animationBox!.height),
    ).toBeGreaterThanOrEqual(15);

    await page.setViewportSize({ width: 3930, height: 1650 });
    await section.evaluate((element) =>
      element.scrollIntoView({ block: "center" }),
    );

    const ultraWideAnimationBox = await animation.boundingBox();
    expect(ultraWideAnimationBox).not.toBeNull();
    expect(ultraWideAnimationBox!.height).toBeLessThanOrEqual(700);
  });

  test("Get Started link navigates to workspace", async ({ page }) => {
    mockLangGraphAPI(page);

    await page.goto("/");

    const getStarted = page.getByRole("link", { name: /get started/i });
    await getStarted.click();

    // Should redirect to /workspace/chats/new
    await page.waitForURL("**/workspace/chats/new");
    await expect(page).toHaveURL(/\/workspace\/chats\/new/);
  });
});
