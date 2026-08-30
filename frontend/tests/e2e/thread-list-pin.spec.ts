import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI, THREAD_PINNED_METADATA_KEY } from "./utils/mock-api";

const NEWEST_THREAD_ID = "00000000-0000-0000-0000-000000000901";
const OLDER_THREAD_ID = "00000000-0000-0000-0000-000000000902";

async function recentChatTitles(page: Page) {
  return page
    .locator('a[data-sidebar="menu-button"][href^="/workspace/chats/"]')
    .evaluateAll((links) =>
      links
        .map((link) => link.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .filter((text) => text && text !== "New chat"),
    );
}

test("sidebar recent chats can be pinned and unpinned", async ({ page }) => {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: NEWEST_THREAD_ID,
        title: "Newest chat",
        updated_at: "2026-07-04T10:00:00Z",
      },
      {
        thread_id: OLDER_THREAD_ID,
        title: "Older chat",
        updated_at: "2026-07-03T10:00:00Z",
      },
    ],
  });

  await page.goto("/workspace/chats/new");

  await expect(page.getByText("Newest chat")).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(() => recentChatTitles(page))
    .toEqual(["Newest chat", "Older chat"]);

  const olderItem = page
    .locator(
      `a[data-sidebar="menu-button"][href="/workspace/chats/${OLDER_THREAD_ID}"]`,
    )
    .locator("xpath=..");
  await olderItem.hover();
  await olderItem.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Pin chat" }).click();

  await expect
    .poll(() => recentChatTitles(page))
    .toEqual(["Older chat", "Newest chat"]);

  await olderItem.hover();
  await olderItem.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Unpin chat" }).click();

  await expect
    .poll(() => recentChatTitles(page))
    .toEqual(["Newest chat", "Older chat"]);
});

test("server-side search keeps old pinned chats in the first page", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    threads: [
      ...Array.from({ length: 51 }, (_, index) => ({
        thread_id: `00000000-0000-0000-0000-000000001${String(index).padStart(3, "0")}`,
        title: `Recent chat ${index + 1}`,
        updated_at: new Date(
          Date.UTC(2026, 6, 25, 10, 0, 0) - index * 60_000,
        ).toISOString(),
      })),
      {
        thread_id: OLDER_THREAD_ID,
        title: "Old pinned chat",
        updated_at: "2026-01-01T10:00:00Z",
        metadata: { [THREAD_PINNED_METADATA_KEY]: true },
      },
    ],
  });

  await page.goto("/workspace/chats/new");

  await expect(page.getByText("Old pinned chat")).toBeVisible({
    timeout: 15_000,
  });
  await expect
    .poll(async () => (await recentChatTitles(page)).slice(0, 2))
    .toEqual(["Old pinned chat", "Recent chat 1"]);
});

/*
  Deleting a conversation is destructive, and it used to fail silently:
  `useDeleteThread` had no `onError`, so a rejected delete left the row in place
  and said nothing — indistinguishable from the click not registering.
  The Vue app pins the same contract in
  `frontend-vue/tests/e2e/thread-list-a11y-shape.spec.ts`.
*/
test("a rejected delete says so and offers a retry, instead of doing nothing", async ({
  page,
}) => {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: NEWEST_THREAD_ID,
        title: "Newest chat",
        updated_at: "2026-07-04T10:00:00Z",
      },
    ],
  });
  let attempts = 0;
  await page.route(
    `**/api/langgraph/threads/${NEWEST_THREAD_ID}`,
    async (route) => {
      if (route.request().method() !== "DELETE") {
        return route.fallback();
      }
      attempts += 1;
      // 403, not 503: the SDK's AsyncCaller retries 5xx with backoff, so a 503
      // only surfaces as an error many seconds later. A permission denial is
      // both realistic and immediate.
      return route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ detail: "delete rejected" }),
      });
    },
  );

  await page.goto("/workspace/chats/new");
  const item = page
    .locator(
      `a[data-sidebar="menu-button"][href="/workspace/chats/${NEWEST_THREAD_ID}"]`,
    )
    .locator("xpath=..");
  await expect(item).toBeVisible({ timeout: 15_000 });
  await item.hover();
  await item.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();

  await expect.poll(() => attempts).toBe(1);

  const alert = page.getByTestId("delete-chat-error");
  await expect(alert).toBeVisible();
  await expect(alert).toHaveRole("alert");
  // The row is still there — the failure did not masquerade as a success.
  await expect(item).toBeVisible();

  await alert.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => attempts).toBe(2);
});
