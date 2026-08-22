/*
  【文件职责】     以真实 Auth/FastAPI/SQLite/LangGraph/setup_agent/Nuxt/Chromium 验证 WP-09 Agent lifecycle。
  【对应 frontend/】 React Agent e2e 没有真实 Gateway 创建/设置对照
  【架构位置】     WP-09 real-backend acceptance
  【主要导出】     Playwright HTTP 与 browser scenarios
  【依赖关系】     run_replay_gateway.py · agent_e2e_fixture.py · Vue Agent UI
  【边界与注意】   LLM 受控；ToolMessage、router、store、用户隔离、Auth/CSRF 与 UI 均为真实实现。
*/

import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test";

const APP = `http://localhost:${process.env.E2E_WP09_FRONTEND_PORT ?? "3112"}`;
const PASSWORD = "very-strong-password-123";
const AGENT_NAME = "wp09-reviewer";

async function initializeAdmin(request: APIRequestContext) {
  const response = await request.post(`${APP}/api/v1/auth/initialize`, {
    data: {
      email: `e2e-wp09-admin-${Date.now()}@example.com`,
      password: PASSWORD,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
}

async function registerUser(request: APIRequestContext) {
  const response = await request.post(`${APP}/api/v1/auth/register`, {
    data: {
      email: `e2e-wp09-user-${Date.now()}@example.com`,
      password: PASSWORD,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
}

async function csrfHeaders(request: APIRequestContext) {
  const storage = await request.storageState();
  const csrf = storage.cookies.find(({ name }) => name === "csrf_token")?.value;
  expect(csrf).toBeTruthy();
  return { "X-CSRF-Token": csrf ?? "" };
}

async function setEnabled(context: BrowserContext, enabled: boolean) {
  const response = await context.request.post(
    `${APP}/api/test-only/agents/set-enabled`,
    { headers: await csrfHeaders(context.request), data: { enabled } },
  );
  expect(response.status(), await response.text()).toBe(200);
  await expect
    .poll(async () => {
      const features = await context.request.get(`${APP}/api/features`);
      return (await features.json()) as { agents_api: { enabled: boolean } };
    })
    .toMatchObject({ agents_api: { enabled } });
}

test.describe.serial("WP-09 real Gateway Agent lifecycle", () => {
  test("unauthenticated API and workspace navigation use the real shared login boundary", async ({
    page,
    request,
  }) => {
    const agents = await request.get(`${APP}/api/agents`);
    expect(agents.status()).toBe(401);
    expect(await agents.json()).toEqual({
      detail: { code: "not_authenticated", message: "Authentication required" },
    });
    const models = await request.get(`${APP}/api/models`);
    expect(models.status()).toBe(401);

    await page.goto("/workspace/agents");
    await expect(page).toHaveURL(/\/login\?redirect=\/workspace\/agents/);
  });

  test("admin creates through the real setup_agent tool, persists exact settings, and sees truthful errors", async ({
    context,
    page,
  }) => {
    await initializeAdmin(context.request);
    const headers = await csrfHeaders(context.request);

    const modelsResponse = await context.request.get(`${APP}/api/models`);
    expect(modelsResponse.status(), await modelsResponse.text()).toBe(200);
    const modelNames = (
      (await modelsResponse.json()) as {
        models: Array<{
          name: string;
          supports_thinking: boolean;
          supports_reasoning_effort: boolean;
        }>;
      }
    ).models.map((model) => ({
      name: model.name,
      thinking: model.supports_thinking,
      reasoning: model.supports_reasoning_effort,
    }));
    expect(modelNames).toEqual([
      { name: "basic-model", thinking: false, reasoning: false },
      { name: "reasoning-model", thinking: true, reasoning: true },
    ]);

    const check = await context.request.get(
      `${APP}/api/agents/check?name=${AGENT_NAME}`,
    );
    expect(check.status(), await check.text()).toBe(200);
    expect(await check.json()).toEqual({ available: true, name: AGENT_NAME });

    const runBodies: Array<Record<string, unknown>> = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        /\/api\/langgraph\/threads\/[^/]+\/runs\/stream$/.test(
          new URL(request.url()).pathname,
        )
      ) {
        runBodies.push(request.postDataJSON() as Record<string, unknown>);
      }
    });

    await page.goto("/workspace/agents/new");
    await page.getByLabel("Name your new Agent").fill(AGENT_NAME);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByText(
        "Let's design the agent's purpose and review style before saving.",
      ),
    ).toBeVisible({ timeout: 30_000 });
    const save = page.getByTestId("agent-save");
    await expect(save).toBeEnabled();
    await save.evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await expect(page.getByTestId("agent-created")).toBeVisible({
      timeout: 30_000,
    });

    const hiddenRuns = runBodies.filter((body) =>
      (
        (body.input as { messages?: Array<{ additional_kwargs?: unknown }> })
          ?.messages ?? []
      ).some(
        (message) =>
          (message.additional_kwargs as { hide_from_ui?: boolean } | undefined)
            ?.hide_from_ui === true,
      ),
    );
    expect(runBodies).toHaveLength(2);
    expect(hiddenRuns).toHaveLength(1);
    await expect(
      page.getByText(/Please save this custom agent now based on everything/),
    ).toHaveCount(0);

    const createdResponse = await context.request.get(
      `${APP}/api/agents/${AGENT_NAME}`,
    );
    expect(createdResponse.status(), await createdResponse.text()).toBe(200);
    expect(await createdResponse.json()).toMatchObject({
      name: AGENT_NAME,
      description: "Reviews code and explains actionable findings",
      model: null,
      tool_groups: null,
      skills: ["review", "review"],
    });

    const duplicate = await context.request.post(`${APP}/api/agents`, {
      headers,
      data: {
        name: AGENT_NAME,
        description: "duplicate",
        soul: "# Duplicate",
      },
    });
    expect(duplicate.status()).toBe(409);
    const invalid = await context.request.post(`${APP}/api/agents`, {
      headers,
      data: { name: "invalid name", soul: "# Invalid" },
    });
    expect(invalid.status()).toBe(422);
    const unknownModel = await context.request.put(
      `${APP}/api/agents/${AGENT_NAME}`,
      { headers, data: { model: "missing-model" } },
    );
    expect(unknownModel.status()).toBe(422);
    expect(await unknownModel.json()).toEqual({
      detail:
        "Unknown model 'missing-model'. Use a model name defined under `models:` in config.yaml.",
    });
    const missing = await context.request.get(`${APP}/api/agents/not-found`);
    expect(missing.status()).toBe(404);

    await page.getByRole("link", { name: "Back to Gallery" }).click();
    const card = page.getByTestId(`agent-card-${AGENT_NAME}`);
    await expect(card.getByTestId("agent-tool-groups-all")).toHaveText(
      "All configured tool groups",
    );
    await expect(card.getByTestId("agent-skill")).toHaveText([
      "review",
      "review",
    ]);
    await card
      .getByRole("button", { name: `Model settings: ${AGENT_NAME}` })
      .click();
    await page
      .getByTestId("agent-settings-model")
      .selectOption("reasoning-model");
    await page.getByTestId("agent-settings-temperature").fill("0");
    await page.getByTestId("agent-settings-max-tokens").fill("200000");
    await page.getByTestId("agent-settings-thinking").selectOption("off");
    await page.getByTestId("agent-settings-reasoning").selectOption("high");
    const updateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === `/api/agents/${AGENT_NAME}`,
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const updatedHttp = await updateResponse;
    expect(updatedHttp.status(), await updatedHttp.text()).toBe(200);
    expect(updatedHttp.request().postDataJSON()).toEqual({
      model: "reasoning-model",
      model_settings: { temperature: 0, max_tokens: 200000 },
      thinking_enabled: false,
      reasoning_effort: "high",
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(card.getByTestId("agent-model")).toHaveText("reasoning-model");

    const reread = await context.request.get(`${APP}/api/agents/${AGENT_NAME}`);
    expect(await reread.json()).toMatchObject({
      model: "reasoning-model",
      model_settings: { temperature: 0, max_tokens: 200000 },
      thinking_enabled: false,
      reasoning_effort: "high",
    });

    await setEnabled(context, false);
    const disabled = await context.request.get(`${APP}/api/agents`);
    expect(disabled.status()).toBe(403);
    expect(await disabled.json()).toEqual({
      detail:
        "Custom-agent management API is disabled. Set agents_api.enabled=true to expose agent and user-profile routes over HTTP.",
    });
    const callsAfterDisable: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/agents(?:\/|$)/.test(new URL(request.url()).pathname)) {
        callsAfterDisable.push(request.url());
      }
    });
    await page.goto("/workspace/agents");
    await expect(page.getByTestId("agents-feature-disabled")).toBeVisible();
    expect(callsAfterDisable).toEqual([]);
    await setEnabled(context, true);
  });

  test("a second authenticated user has an isolated Agent namespace", async ({
    context,
  }) => {
    await registerUser(context.request);
    const headers = await csrfHeaders(context.request);
    const list = await context.request.get(`${APP}/api/agents`);
    expect(list.status(), await list.text()).toBe(200);
    expect(await list.json()).toEqual({ agents: [] });

    const sameName = await context.request.post(`${APP}/api/agents`, {
      headers,
      data: {
        name: AGENT_NAME,
        description: "Second user's reviewer",
        soul: "# Isolated reviewer",
        model: "basic-model",
        tool_groups: [],
        skills: [],
      },
    });
    expect(sameName.status(), await sameName.text()).toBe(201);
    expect(await sameName.json()).toMatchObject({
      name: AGENT_NAME,
      description: "Second user's reviewer",
      model: "basic-model",
      tool_groups: [],
      skills: [],
    });
  });
});
