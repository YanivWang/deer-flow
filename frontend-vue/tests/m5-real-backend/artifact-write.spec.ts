import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const APP =
  process.env.E2E_APP_URL ??
  `http://localhost:${process.env.E2E_FRONTEND_PORT ?? "3101"}`;
const fixture = JSON.parse(
  readFileSync(
    join(
      here,
      "../../../backend/tests/fixtures/replay/write_read_file.ultra.json",
    ),
    "utf8",
  ),
) as { prompt: string };

test("real Gateway streams a write-file draft into the artifact panel", async ({
  page,
  context,
}) => {
  const email = `e2e-m5-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const registration = await context.request.post(
    `${APP}/api/v1/auth/register`,
    { data: { email, password: "very-strong-password-123" } },
  );
  expect(registration.status(), await registration.text()).toBe(201);

  await page.addInitScript(() => {
    localStorage.setItem(
      "deerflow.local-settings",
      JSON.stringify({ context: { mode: "ultra" } }),
    );
  });
  await page.goto("/workspace/chats/new");

  const textarea = page.getByPlaceholder(/how can i assist you/i);
  await expect(textarea).toBeVisible({ timeout: 30_000 });
  await textarea.fill(fixture.prompt);
  await textarea.press("Enter");

  const artifacts = page.locator("#artifacts");
  await expect(artifacts).toBeVisible({ timeout: 60_000 });
  await expect(artifacts.getByText("note.txt", { exact: true })).toBeVisible();
  await expect(
    artifacts.getByText("hi from replay.", { exact: true }),
  ).toBeVisible();
});
