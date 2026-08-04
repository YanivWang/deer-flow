/*
  【文件职责】     用真实 Chromium Origin 与认证 Cookie 验证 browser-view WebSocket。
  【对应 frontend/】 frontend/src/components/workspace/browser-view/api.ts
  【架构位置】     测试
  【主要导出】     @ws case
  【依赖关系】     需要启用 browser control 的真实 Gateway/runtime
  【边界与注意】   必须先经 REST 建立 live browser session，否则 Gateway 以 4404 关闭；
                   该 4404 是"没有会话"，不是握手通过，绝不能当成 Gate 通过。
*/

import { expect, test } from "@playwright/test";

const GATEWAY_WS_ORIGIN =
  process.env.M0_GATEWAY_WS_ORIGIN ?? "ws://localhost:8011";

test("@ws upgrades with browser Origin and Cookie and receives a binary frame", async ({
  context,
  page,
}) => {
  const email = `m0-ws-${Date.now()}@example.com`;
  const register = await context.request.post("/api/v1/auth/register", {
    data: { email, password: "very-strong-password-123" },
  });
  expect(register.status(), await register.text()).toBe(201);
  const csrf = (await context.cookies()).find(
    ({ name }) => name === "csrf_token",
  )?.value;
  expect(csrf).toBeTruthy();

  const threadId = crypto.randomUUID();
  const thread = await context.request.post("/api/threads", {
    headers: { "X-CSRF-Token": csrf ?? "" },
    data: { thread_id: threadId, metadata: {} },
  });
  expect(thread.status(), await thread.text()).toBe(200);

  // The Live stream attaches to a retained session; without this the Gateway
  // closes with 4404 and the gate would be "passing" on an empty surface.
  // Navigating at the Nuxt preview keeps the probe hermetic (no public network).
  const navigate = await context.request.post(
    `/api/threads/${threadId}/browser/navigate`,
    {
      headers: { "X-CSRF-Token": csrf ?? "" },
      data: { url: "http://localhost:3101/" },
      timeout: 60_000,
    },
  );
  expect(
    navigate.status(),
    `browser session bootstrap failed: ${await navigate.text()} ` +
      "(404 means browser_navigate is not configured; 501 means Playwright is missing)",
  ).toBe(200);

  await page.goto("/");
  const result = await page.evaluate(
    ({ id, wsOrigin }) =>
      new Promise<{ opened: boolean; binary: boolean; closeCode: number }>(
        (resolve) => {
          const socket = new WebSocket(
            `${wsOrigin}/api/threads/${id}/browser/stream?frame_format=binary`,
          );
          socket.binaryType = "arraybuffer";
          let opened = false;
          const timeout = window.setTimeout(() => {
            socket.close();
            resolve({ opened, binary: false, closeCode: 0 });
          }, 30_000);
          socket.onopen = () => {
            opened = true;
          };
          socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
              window.clearTimeout(timeout);
              socket.close();
              resolve({ opened, binary: true, closeCode: 1000 });
            }
          };
          socket.onclose = (event) => {
            window.clearTimeout(timeout);
            resolve({ opened, binary: false, closeCode: event.code });
          };
        },
      ),
    { id: threadId, wsOrigin: GATEWAY_WS_ORIGIN },
  );
  expect(
    result.opened,
    `WebSocket closed with ${result.closeCode} (4401 unauthenticated, 4403 cross-origin, 4404 no session)`,
  ).toBe(true);
  expect(
    result.binary,
    `upgrade succeeded but no binary frame arrived; closed with ${result.closeCode}`,
  ).toBe(true);
});
