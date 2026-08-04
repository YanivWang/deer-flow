/*
  【文件职责】     经 Nuxt preview 同源代理验证真实 Gateway Cookie/CSRF 生命周期。
  【对应 frontend/】 frontend/tests/e2e-real-backend/real-backend-render.spec.ts
  【架构位置】     测试
  【主要导出】     @auth-cookie case
  【依赖关系】     使用仓库 replay Gateway，认证保持开启
  【边界与注意】   不记录 token、Cookie 或 CSRF 实值。
*/

import { expect, test } from "@playwright/test";

test("@auth-cookie register, login rotation, protected write, me and logout", async ({
  context,
}) => {
  const api = context.request;
  const email = `m0-${Date.now()}@example.com`;
  const password = "very-strong-password-123";
  const register = await api.post("/api/v1/auth/register", {
    data: { email, password, remember_me: false },
  });
  expect(register.status(), await register.text()).toBe(201);
  const setCookies = register
    .headersArray()
    .filter(({ name }) => name.toLowerCase() === "set-cookie");
  expect(
    setCookies.some(
      ({ value }) =>
        value.startsWith("access_token=") && value.includes("HttpOnly"),
    ),
  ).toBe(true);
  expect(
    setCookies.some(
      ({ value }) =>
        value.startsWith("csrf_token=") && value.includes("SameSite=strict"),
    ),
  ).toBe(true);

  const firstCookies = await context.cookies();
  const firstCsrf = firstCookies.find(
    ({ name }) => name === "csrf_token",
  )?.value;
  expect(firstCsrf).toBeTruthy();

  const threadId = crypto.randomUUID();
  const created = await api.post("/api/threads", {
    headers: { "X-CSRF-Token": firstCsrf ?? "" },
    data: { thread_id: threadId, metadata: {} },
  });
  expect(created.status(), await created.text()).toBe(200);

  const rejected = await api.post("/api/threads", {
    headers: { "X-CSRF-Token": "redacted-invalid" },
    data: { thread_id: crypto.randomUUID(), metadata: {} },
  });
  expect(rejected.status()).toBe(403);

  const login = await api.post("/api/v1/auth/login/local", {
    form: { username: email, password, remember_me: "false" },
  });
  expect(login.status(), await login.text()).toBe(200);
  const secondCsrf = (await context.cookies()).find(
    ({ name }) => name === "csrf_token",
  )?.value;
  expect(secondCsrf).toBeTruthy();
  expect(secondCsrf).not.toBe(firstCsrf);

  expect((await api.get("/api/v1/auth/me")).status()).toBe(200);
  expect(
    (
      await api.post("/api/v1/auth/logout", {
        headers: { "X-CSRF-Token": secondCsrf ?? "" },
      })
    ).status(),
  ).toBe(200);
  expect((await api.get("/api/v1/auth/me")).status()).toBe(401);
});
