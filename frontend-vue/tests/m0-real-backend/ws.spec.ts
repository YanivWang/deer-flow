/*
  【文件职责】     用真实 Chromium Origin 与认证 Cookie 验证 browser-view WebSocket。
  【对应 frontend/】 frontend/src/components/workspace/browser-view/api.ts
  【架构位置】     测试
  【主要导出】     @ws case
  【依赖关系】     需要启用 browser control 的真实 Gateway/runtime
  【边界与注意】   replay Gateway 未启用 browser runtime 时必须失败为外部前提，不得降级成 4404 通过。
*/

import { expect, test } from "@playwright/test";

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

  await page.goto("/");
  const result = await page.evaluate(
    (id) =>
      new Promise<{ opened: boolean; binary: boolean; closeCode: number }>(
        (resolve) => {
          const socket = new WebSocket(
            `ws://localhost:8011/api/threads/${id}/browser/stream?frame_format=binary`,
          );
          socket.binaryType = "arraybuffer";
          let opened = false;
          const timeout = window.setTimeout(() => {
            socket.close();
            resolve({ opened, binary: false, closeCode: 0 });
          }, 15_000);
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
    threadId,
  );
  expect(result.opened, `WebSocket closed with ${result.closeCode}`).toBe(true);
  expect(result.binary, `WebSocket closed with ${result.closeCode}`).toBe(true);
});
