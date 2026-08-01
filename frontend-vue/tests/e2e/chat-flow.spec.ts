import { expect, test } from "@playwright/test";

import {
  authenticateVuePage,
  MOCK_AI_REPLY,
  MOCK_RUN_ID,
  MOCK_THREAD_ID,
  mockVueChatApi,
} from "./utils/mock-api";

test("sends a workspace chat message and renders the streamed AI response", async ({
  baseURL,
  page,
}) => {
  await authenticateVuePage(page, baseURL);
  mockVueChatApi(page);

  await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);

  await expect(page.getByRole("heading", { name: "Mock Chat" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId("vue-chat-input").fill("Hello DeerFlow");
  await page.getByTestId("vue-chat-send").click();

  const messages = page.getByTestId("vue-thread-stream-messages");
  await expect(messages.getByText("Hello DeerFlow")).toBeVisible();
  await expect(messages.getByText(MOCK_AI_REPLY)).toBeVisible();
  await expect(page.getByTestId("vue-thread-stream-status")).toContainText(
    `Run: ${MOCK_RUN_ID}`,
  );
  await expect(page.getByTestId("vue-thread-stream-status")).toContainText("Messages: 2");
});
