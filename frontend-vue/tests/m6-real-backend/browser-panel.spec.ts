import { expect, test } from "@playwright/test";

test("real Gateway streams a binary browser frame into the Vue browser panel", async ({
  context,
  page,
}) => {
  const email = `e2e-m6-browser-${Date.now()}@example.com`;
  const registration = await context.request.post("/api/v1/auth/register", {
    data: { email, password: "very-strong-password-123" },
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const csrf = (await context.cookies()).find(
    ({ name }) => name === "csrf_token",
  )?.value;
  expect(csrf).toBeTruthy();

  const threadId = crypto.randomUUID();
  const created = await context.request.post("/api/threads", {
    headers: { "X-CSRF-Token": csrf ?? "" },
    data: { thread_id: threadId, metadata: {} },
  });
  expect(created.status(), await created.text()).toBe(200);

  const navigate = await context.request.post(
    `/api/threads/${threadId}/browser/navigate`,
    {
      headers: { "X-CSRF-Token": csrf ?? "" },
      data: { url: "http://localhost:3101/" },
      timeout: 60_000,
    },
  );
  expect(navigate.status(), await navigate.text()).toBe(200);

  await page.goto(`/workspace/chats/${threadId}`);
  await page.getByRole("button", { name: "Open browser panel" }).click();

  const panel = page.getByRole("dialog", { name: "Browser" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("open", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const frame = panel.getByRole("img", { name: "Browser view" });
  await expect(frame).toBeVisible({ timeout: 30_000 });
  await expect(frame).toHaveAttribute("src", /^blob:/);
});
