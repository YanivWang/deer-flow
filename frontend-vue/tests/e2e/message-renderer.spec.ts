import { expect, test } from "@playwright/test";

import {
  mockLangGraphAPI,
  MOCK_RUN_ID,
  MOCK_THREAD_ID,
} from "./utils/mock-api";

const rendererContent = `# Renderer parity

Paragraph with **strong**, *emphasis*, \`inline\`, [a link](https://example.com/docs), ![chart](https://example.com/chart.png), and ![missing](https://example.invalid/missing.png).

Named entities: &Aacute; &CounterClockwiseContourIntegral;. Incomplete [visible](https://example.invalid/incomplete.

Display math: \\[x^2 + y^2 = z^2\\]

- first item
- second item

> quoted source

| Name | Value |
| :--- | ---: |
| answer | 42 |

\`\`\`typescript
const answer: number = 42;
const longLine = "${"x".repeat(2200)}";
\`\`\`

\`\`\`javascript
const partial = true;
`;

test("renders the complete message renderer surface in a real Vue browser", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => undefined },
    });
  });
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: MOCK_THREAD_ID,
        title: "Message renderer parity",
        updated_at: "2026-05-24T04:47:01.123949+00:00",
      },
    ],
  });

  await page.route(/\/api\/langgraph\/threads\/[^/]+\/runs(\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          run_id: MOCK_RUN_ID,
          thread_id: MOCK_THREAD_ID,
          status: "success",
          created_at: "2026-05-24T04:46:42.565307+00:00",
          updated_at: "2026-05-24T04:47:01.123949+00:00",
        },
      ]),
    }),
  );
  await page.route("https://example.invalid/missing.png", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.route(
    `**/api/threads/${MOCK_THREAD_ID}/runs/**/workspace-changes**`,
    (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );
  await page.route(`**/api/threads/${MOCK_THREAD_ID}/messages/page`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            thread_id: MOCK_THREAD_ID,
            run_id: MOCK_RUN_ID,
            event_type: "llm.ai.response",
            category: "message",
            content: {
              content: rendererContent,
              additional_kwargs: {},
              type: "ai",
              id: "renderer-ai",
              tool_calls: [],
            },
            seq: 720,
            created_at: "2026-05-24T04:47:01.123949+00:00",
            metadata: { content_is_json: true, content_is_dict: true },
          },
          {
            thread_id: MOCK_THREAD_ID,
            run_id: MOCK_RUN_ID,
            event_type: "error",
            category: "message",
            content: {
              content: "renderer error is visible",
              type: "error",
              id: "renderer-error",
            },
            seq: 721,
            created_at: "2026-05-24T04:47:02.123949+00:00",
            metadata: { content_is_json: true, content_is_dict: true },
          },
        ],
        has_more: false,
        next_before_seq: null,
      }),
    }),
  );

  await page.goto(`/workspace/chats/${MOCK_THREAD_ID}`);

  await expect(page.getByTestId("vue-message-heading")).toContainText("Renderer parity");
  await expect(page.getByTestId("vue-message-blockquote")).toContainText("quoted source");
  await expect(page.getByTestId("vue-message-table")).toContainText("42");
  await expect(page.getByTestId("vue-message-link").first()).toHaveAttribute(
    "href",
    "https://example.com/docs",
  );
  await expect(page.getByTestId("vue-message-image-link").first()).toBeVisible();
  await expect(page.getByTestId("vue-message-image-error").filter({ hasText: "missing" })).toBeVisible();
  await expect(page.getByTestId("vue-message-inline-math")).toContainText("x");
  await expect(page.getByTestId("vue-message-paragraph").filter({ hasText: "Named entities" })).toContainText(
    "Á",
  );
  await expect(page.getByTestId("vue-message-paragraph").filter({ hasText: "Incomplete" })).toContainText(
    "visible",
  );
  await expect(page.getByTestId("vue-message-code-language").first()).toHaveText("typescript");
  await expect
    .poll(() => page.locator('[data-streamdown="code-block-body"] code > span > span').count())
    .toBeGreaterThan(1);
  const copyButton = page.getByTestId("vue-message-code-copy").first();
  await expect(copyButton).toBeVisible();
  await copyButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("vue-message-code-copy-status").first()).toHaveText("已复制");
  await expect(page.getByTestId("vue-message-error-1")).toContainText("renderer error is visible");

  const codeBody = page.locator('[data-streamdown="code-block-body"]').first();
  await expect
    .poll(() => codeBody.evaluate((element) => element.scrollWidth > element.clientWidth))
    .toBe(true);

  await page.screenshot({
    path: testInfo.outputPath("message-renderer.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("message-renderer-mobile.png"),
    fullPage: true,
  });
});
