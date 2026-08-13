/*
  【文件职责】     用可控 IdP 验证 OIDC 从 Vue 入口发起后回到 Vue 入口。
  【对应 frontend/】 frontend/tests/e2e-auth/auth-setup-recovery.spec.ts
  【架构位置】     测试
  【主要导出】     @oidc case
  【依赖关系】     tests/support/run_m0_idp.py（仓库内可控 provider）
  【边界与注意】   两条机制合起来才是"Vue 用户不会被送回 React"：callback 由发起入口
                   推导，回跳保持相对路径。provider 的 redirect_uri 与全局
                   frontend_base_url 都必须留空，任一被写死都会让本用例失去意义。
                   两个独立 hostname + DNS/TLS 属 M7，不在本用例范围内。
*/

import { expect, test } from "@playwright/test";

const IDP_ORIGIN = process.env.M0_IDP_ORIGIN ?? "http://127.0.0.1:8013";
const PROVIDER = "m0idp";
const VUE_ORIGIN = "http://localhost:3101";
const REACT_HOST_ORIGIN = "http://react.localhost:3101";
const VUE_HOST_ORIGIN = "http://vue.localhost:3101";

test("@oidc returns to the entry that started the flow", async ({
  context,
  page,
}) => {
  const providers = await context.request.get("/api/v1/auth/providers");
  expect(providers.status(), await providers.text()).toBe(200);
  const body = (await providers.json()) as {
    providers?: { id?: string }[];
  };
  expect(
    body.providers?.map(({ id }) => id),
    "G0-7 needs a controlled IdP; run_m0_idp.py must be up and wired into the Gateway config",
  ).toContain(PROVIDER);

  // Drive the whole authorization-code flow in a real browser: Gateway 302 ->
  // IdP /authorize -> IdP 302 back to the callback -> Gateway 302 (relative).
  await page.goto(`/api/v1/auth/oauth/${PROVIDER}?next=/workspace`);

  // The landing origin is the entire point of the gate: a hard-coded
  // frontend_base_url would send this user to the React entry instead.
  await page.waitForURL(`${VUE_ORIGIN}/auth/callback**`);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/workspace");

  // The callback the Gateway handed the IdP must belong to this entry, not to
  // the Gateway itself — that only holds because the Nitro proxy forwards the
  // client-facing origin.
  const log = await context.request.get(`${IDP_ORIGIN}/probe/authorize-log`);
  expect(log.status()).toBe(200);
  const entries = (await log.json()) as { entries: { redirect_uri: string }[] };
  expect(entries.entries.at(-1)?.redirect_uri).toBe(
    `${VUE_ORIGIN}/api/v1/auth/callback/${PROVIDER}`,
  );

  // The flow actually authenticated rather than merely bouncing through.
  const cookies = await context.cookies();
  expect(cookies.map(({ name }) => name)).toContain("access_token");
  const me = await context.request.get("/api/v1/auth/me");
  expect(me.status(), await me.text()).toBe(200);
  expect((await me.json()).email).toBe("m0-oidc-user@example.com");

  // J6: the state cookie is scoped by hostname, never by port, so two entries
  // on one hostname share it. Consuming it at the callback is what bounds that
  // window; the concurrent-login negative test needs a second entry and is
  // covered with the dual-hostname work in M7.
  const stateCookie = cookies.find(({ name }) =>
    name.startsWith("df_oidc_state_"),
  );
  expect(
    stateCookie,
    "the state cookie must be cleared once the callback consumed it",
  ).toBeUndefined();
});

test("@oidc isolates concurrent same-provider state by frontend hostname", async ({
  context,
}) => {
  const reactPage = await context.newPage();
  const vuePage = await context.newPage();

  // Start both authorization-code flows together in one browser context. The
  // cookie name is intentionally identical, so this can succeed only when the
  // two public entries have independent host cookie jars (J6).
  await Promise.all([
    reactPage.goto(
      `${REACT_HOST_ORIGIN}/api/v1/auth/oauth/${PROVIDER}?next=/workspace`,
    ),
    vuePage.goto(
      `${VUE_HOST_ORIGIN}/api/v1/auth/oauth/${PROVIDER}?next=/workspace`,
    ),
  ]);

  await Promise.all([
    reactPage.waitForURL(`${REACT_HOST_ORIGIN}/auth/callback**`),
    vuePage.waitForURL(`${VUE_HOST_ORIGIN}/auth/callback**`),
  ]);

  const [reactCookies, vueCookies] = await Promise.all([
    context.cookies([REACT_HOST_ORIGIN]),
    context.cookies([VUE_HOST_ORIGIN]),
  ]);
  expect(reactCookies.find(({ name }) => name === "access_token")?.domain).toBe(
    "react.localhost",
  );
  expect(vueCookies.find(({ name }) => name === "access_token")?.domain).toBe(
    "vue.localhost",
  );
  expect(
    [...reactCookies, ...vueCookies].filter(({ name }) =>
      name.startsWith("df_oidc_state_"),
    ),
    "both independently scoped state cookies must be consumed",
  ).toHaveLength(0);

  const log = await context.request.get(`${IDP_ORIGIN}/probe/authorize-log`);
  expect(log.status(), await log.text()).toBe(200);
  const entries = (await log.json()) as { entries: { redirect_uri: string }[] };
  const recentRedirects = entries.entries
    .slice(-2)
    .map(({ redirect_uri }) => redirect_uri)
    .sort();
  expect(recentRedirects).toEqual(
    [
      `${REACT_HOST_ORIGIN}/api/v1/auth/callback/${PROVIDER}`,
      `${VUE_HOST_ORIGIN}/api/v1/auth/callback/${PROVIDER}`,
    ].sort(),
  );
});
