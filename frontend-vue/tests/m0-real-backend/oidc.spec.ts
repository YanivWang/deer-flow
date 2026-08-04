/*
  【文件职责】     阻止缺少可控 IdP 时把 OIDC 双回跳 Gate 误报为通过。
  【对应 frontend/】 frontend/tests/e2e-auth/auth-setup-recovery.spec.ts
  【架构位置】     测试
  【主要导出】     @oidc case
  【依赖关系】     需要配置双 callback 的可控 OIDC provider
  【边界与注意】   replay Gateway 默认没有 provider；该失败是明确外部阻塞，不是 skip。
*/

import { expect, test } from "@playwright/test";

test("@oidc requires a controlled provider before dual callback testing", async ({
  request,
}) => {
  const response = await request.get("/api/v1/auth/providers");
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as { providers?: unknown[] };
  expect(
    body.providers?.length ?? 0,
    "G0-7 requires a controlled IdP with React and Vue callback URIs; replay Gateway has none",
  ).toBeGreaterThan(0);
});
