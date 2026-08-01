import { expect, test } from "@playwright/test";

test("login page renders on the local dev origin", async ({ page, baseURL }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "DeerFlow" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
  expect(baseURL).toContain("127.0.0.1");
});

test("protected workspace redirects without the access token cookie", async ({ page }) => {
  await page.goto("/workspace");

  await expect(page).toHaveURL(/\/login$/);
});
