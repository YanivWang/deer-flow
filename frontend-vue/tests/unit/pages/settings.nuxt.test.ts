import { mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { useRouter, useState } from "#app";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "../../../app/pages/workspace/settings.vue";
import { WORKSPACE_PREFERENCES_KEY } from "../../../app/core/settings/preferences";

describe("workspace settings page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("switches between core settings sections", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const path = requestPath(url);
        if (path === "/api/memory") {
          return Response.json(memoryWithFacts([]));
        }
        if (path === "/api/mcp/config") {
          return Response.json(mcpConfig({ github: mcpServer("GitHub MCP server", true) }));
        }
        return new Response(null, { status: 401 });
      }),
    );
    const router = useRouter();
    const replaceSpy = vi.spyOn(router, "replace").mockResolvedValue();
    const wrapper = await mountSuspended(SettingsPage, { route: "/workspace/settings" });
    await flushPromises();

    await wrapper.get('[data-testid="vue-settings-nav-memory"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-settings-section-memory"]').text()).toContain(
      "/api/memory",
    );
    await wrapper.get('[data-testid="vue-settings-nav-tools"]').trigger("click");
    await flushPromises();

    expect(replaceSpy).toHaveBeenCalledWith({
      hash: "#tools",
      query: { settings: "tools" },
    });
    expect(wrapper.get('[data-testid="vue-settings-section-tools"]').text()).toContain(
      "/api/mcp/config",
    );

    await wrapper.get('[data-testid="vue-settings-nav-about"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-settings-about-anchor"]').text()).toContain(
      "关于 DeerFlow 开发版",
    );
    expect(wrapper.get('[data-testid="vue-settings-about-anchor"]').text()).toContain(
      "GitHub 仓库",
    );
    expect(wrapper.get('[data-testid="vue-settings-about-anchor"]').text()).toContain(
      "验证边界",
    );
    expect(wrapper.get('[data-testid="vue-settings-about-anchor"]').text()).toContain(
      "frontend-vue",
    );
  });

  it("restores settings section and dialog state from query or hash deep links", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) =>
        requestPath(url) === "/api/integrations/lark/status"
          ? Response.json(larkStatus())
          : new Response(null, { status: 401 }),
      ),
    );
    const wrapper = await mountSuspended(SettingsPage, {
      route: {
        hash: "#appearance",
        path: "/workspace/settings",
        query: { dialog: "lark-auth" },
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="vue-settings-section-integrations"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="vue-settings-integrations-lark-auth-dialog"]').exists()).toBe(true);

    const hashOnly = await mountSuspended(SettingsPage, {
      route: { hash: "#about", path: "/workspace/settings" },
    });
    await flushPromises();
    expect(hashOnly.find('[data-testid="vue-settings-section-about"]').exists()).toBe(true);
  });

  it("persists appearance theme and locale locally", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    const themeMode = useState<"light" | "dark">("theme-mode");
    const locale = useState<"en-US" | "zh-CN">("locale");
    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "appearance" } },
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-settings-nav-appearance"]').attributes("aria-current")).toBe(
      "page",
    );
    expect(wrapper.get('[data-testid="vue-settings-theme-dark"]').attributes("aria-label")).toBe(
      "选择深色主题",
    );
    expect(wrapper.get('[data-testid="vue-settings-theme-system"]').attributes("aria-pressed")).toBe(
      "true",
    );
    expect(wrapper.get('[data-testid="vue-settings-locale"]').attributes("aria-label")).toBe(
      "界面语言",
    );

    await wrapper.get('[data-testid="vue-settings-theme-dark"]').trigger("click");
    await wrapper.get('[data-testid="vue-settings-locale"]').setValue("zh-CN");
    await flushPromises();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(wrapper.get('[data-testid="vue-settings-theme-dark"]').attributes("aria-pressed")).toBe(
      "true",
    );
    expect(themeMode.value).toBe("dark");
    expect(locale.value).toBe("zh-CN");
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_PREFERENCES_KEY) ?? "{}")).toEqual({
      appearance: { locale: "zh-CN", theme: "dark" },
      notification: { enabled: true },
    });

    await wrapper.get('[data-testid="vue-settings-theme-system"]').trigger("click");
    await flushPromises();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(themeMode.value).toBe("light");
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_PREFERENCES_KEY) ?? "{}")).toEqual({
      appearance: { locale: "zh-CN", theme: "system" },
      notification: { enabled: true },
    });
  });

  it("loads account profile, validates password form, and changes password", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(
        Response.json({
          id: "user-1",
          email: "user@example.com",
          system_role: "admin",
          oauth_provider: null,
        }),
      )
      .mockResolvedValueOnce(Response.json({ message: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "account" } },
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-settings-account-profile"]').text()).toContain(
      "user@example.com",
    );

    await wrapper.get('[data-testid="vue-settings-new-password"]').setValue("short");
    await wrapper.get('[data-testid="vue-settings-confirm-password"]').setValue("different");
    await wrapper.get('[data-testid="vue-settings-password-form"]').trigger("submit");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-settings-account-error"]').text()).toContain(
      "不一致",
    );
    expect(wrapper.get('[data-testid="vue-settings-account-error"]').attributes("role")).toBe(
      "alert",
    );
    expect(wrapper.get('[data-testid="vue-settings-password-form"]').attributes("aria-describedby")).toBe(
      "vue-settings-account-error-message",
    );
    expect(wrapper.get('[data-testid="vue-settings-new-password"]').attributes("aria-invalid")).toBe(
      "true",
    );

    await wrapper.get('[data-testid="vue-settings-current-password"]').setValue("old-password");
    await wrapper.get('[data-testid="vue-settings-new-password"]').setValue("new-password");
    await wrapper.get('[data-testid="vue-settings-confirm-password"]').setValue("new-password");
    await wrapper.get('[data-testid="vue-settings-password-form"]').trigger("submit");
    await flushPromises();

    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/auth/change-password");
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          current_password: "old-password",
          new_password: "new-password",
        }),
        method: "POST",
      }),
    );
    expect(wrapper.get('[data-testid="vue-settings-account-message"]').text()).toContain(
      "密码已修改",
    );
    expect(wrapper.get('[data-testid="vue-settings-account-message"]').attributes("role")).toBe(
      "status",
    );
  });

  it("logs out through the Gateway auth endpoint and returns home", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ id: "user-1", email: "u@example.com", system_role: "user" }))
      .mockResolvedValueOnce(Response.json({ message: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    const router = useRouter();
    const pushSpy = vi.spyOn(router, "push").mockResolvedValue();
    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "account" } },
    });
    await flushPromises();

    await wrapper.get('[data-testid="vue-settings-logout"]').trigger("click");
    await flushPromises();

    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/auth/logout");
    expect(pushSpy).toHaveBeenCalledWith("/");
  });

  it("shows SSO account semantics without the password form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "user-1",
          email: "sso@example.com",
          system_role: "user",
          oauth_provider: "github",
        }),
      ),
    );
    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "account" } },
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-settings-account-sso"]').text()).toContain("SSO");
    expect(wrapper.find('[data-testid="vue-settings-password-form"]').exists()).toBe(false);
  });

  it("loads, creates, validates, and deletes memory facts through the Gateway memory contract", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = requestPath(url);
      const method = init?.method ?? "GET";
      if (path === "/api/v1/auth/me") {
        return new Response(null, { status: 401 });
      }
      if (path === "/api/memory" && method === "GET") {
        return Response.json(memoryWithFacts([memoryFact("fact-1", "Use Vue", "preference", 0.8)]));
      }
      if (path === "/api/memory/facts" && method === "POST") {
        return Response.json(memoryWithFacts([memoryFact("fact-2", "Prefer Nuxt", "preference", 0.9)]));
      }
      if (path === "/api/memory/facts/fact-2" && method === "PATCH") {
        return Response.json(memoryWithFacts([memoryFact("fact-2", "Prefer Nuxt 4", "project", 1)]));
      }
      if (path === "/api/memory/export" && method === "GET") {
        return Response.json(memoryWithFacts([memoryFact("fact-2", "Prefer Nuxt 4", "project", 1)]));
      }
      if (path === "/api/memory/import" && method === "POST") {
        return Response.json(memoryWithFacts([memoryFact("fact-3", "Imported memory", "archive", 0.7)]));
      }
      if (path === "/api/memory/facts/fact-3" && method === "DELETE") {
        return Response.json(memoryWithFacts([]));
      }
      if (path === "/api/memory" && method === "DELETE") {
        return Response.json(memoryWithFacts([]));
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "memory" } },
    });
    await flushPromises();
    expect(fetchMock.mock.calls.map(([url]) => requestPath(url))).toContain("/api/memory");
    await waitForSelector(wrapper, '[data-testid="vue-settings-memory-summary"]');

    expect(wrapper.get('[data-testid="vue-settings-memory-summary"]').text()).toContain(
      "2026-08-01T00:00:00Z",
    );
    expect(wrapper.get('[data-testid="vue-settings-memory-facts"]').text()).toContain("Use Vue");

    await wrapper.get('[data-testid="vue-settings-memory-content"]').setValue(" ");
    await wrapper.get('[data-testid="vue-settings-memory-form"]').trigger("submit");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-settings-memory-form-error"]').text()).toContain(
      "必填",
    );

    await wrapper.get('[data-testid="vue-settings-memory-content"]').setValue("Prefer Nuxt");
    await wrapper.get('[data-testid="vue-settings-memory-category"]').setValue("preference");
    await wrapper.get('[data-testid="vue-settings-memory-confidence"]').setValue("0.9");
    await wrapper.get('[data-testid="vue-settings-memory-form"]').trigger("submit");
    await flushPromises();

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === "/api/memory/facts" && init?.method === "POST",
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      category: "preference",
      confidence: 0.9,
      content: "Prefer Nuxt",
    });
    expect(wrapper.get('[data-testid="vue-settings-memory-facts"]').text()).toContain("Prefer Nuxt");

    await wrapper.get('[data-testid="vue-settings-memory-edit-fact-2"]').trigger("click");
    await wrapper.get('[data-testid="vue-settings-memory-edit-content"]').setValue("Prefer Nuxt 4");
    await wrapper.get('[data-testid="vue-settings-memory-edit-category"]').setValue("project");
    await wrapper.get('[data-testid="vue-settings-memory-edit-confidence"]').setValue("1");
    await wrapper.get('[data-testid="vue-settings-memory-edit-form"]').trigger("submit");
    await flushPromises();

    const updateCall = fetchMock.mock.calls.find(
      ([url, init]) => requestPath(url) === "/api/memory/facts/fact-2" && init?.method === "PATCH",
    );
    expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
      category: "project",
      confidence: 1,
      content: "Prefer Nuxt 4",
    });
    expect(wrapper.get('[data-testid="vue-settings-memory-facts"]').text()).toContain(
      "Prefer Nuxt 4",
    );

    await wrapper.get('[data-testid="vue-settings-memory-export"]').trigger("click");
    await flushPromises();

    const exportField = wrapper.get('[data-testid="vue-settings-memory-export-json"]')
      .element as HTMLTextAreaElement;
    expect(fetchMock.mock.calls.some(([url]) => requestPath(url) === "/api/memory/export")).toBe(true);
    expect(exportField.value).toContain("Prefer Nuxt 4");

    await wrapper
      .get('[data-testid="vue-settings-memory-import-json"]')
      .setValue(JSON.stringify(memoryWithFacts([memoryFact("fact-3", "Imported memory", "archive", 0.7)])));
    await wrapper.get('[data-testid="vue-settings-memory-import"]').trigger("click");
    await flushPromises();

    const importCall = fetchMock.mock.calls.find(
      ([url, init]) => requestPath(url) === "/api/memory/import" && init?.method === "POST",
    );
    expect(JSON.parse(String(importCall?.[1]?.body)).facts).toHaveLength(1);
    expect(wrapper.get('[data-testid="vue-settings-memory-facts"]').text()).toContain(
      "Imported memory",
    );

    await wrapper.get('[data-testid="vue-settings-memory-delete-fact-3"]').trigger("click");
    await flushPromises();

    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => requestPath(url) === "/api/memory/facts/fact-3" && init?.method === "DELETE",
      ),
    ).toBe(true);
    expect(wrapper.get('[data-testid="vue-settings-memory-empty"]').text()).toContain(
      "暂无已保存的记忆事实",
    );

    await wrapper.get('[data-testid="vue-settings-memory-clear"]').trigger("click");
    await flushPromises();

    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => requestPath(url) === "/api/memory" && init?.method === "DELETE",
      ),
    ).toBe(true);
  });

  it("shows a memory import validation error before contacting the Gateway", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = requestPath(url);
      const method = init?.method ?? "GET";
      if (path === "/api/v1/auth/me") {
        return new Response(null, { status: 401 });
      }
      if (path === "/api/memory" && method === "GET") {
        return Response.json(memoryWithFacts([]));
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "memory" } },
    });
    await waitForSelector(wrapper, '[data-testid="vue-settings-memory-transfer"]');

    await wrapper.get('[data-testid="vue-settings-memory-import-json"]').setValue("{");
    await wrapper.get('[data-testid="vue-settings-memory-import"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-settings-memory-form-error"]').text()).toContain(
      "记忆导出结构",
    );
    expect(fetchMock.mock.calls.every(([url]) => requestPath(url) !== "/api/memory/import")).toBe(
      true,
    );
  });

  it("loads and toggles MCP tools through the Gateway MCP config contract", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = requestPath(url);
      const method = init?.method ?? "GET";
      if (path === "/api/v1/auth/me") {
        return new Response(null, { status: 401 });
      }
      if (path === "/api/mcp/config" && method === "GET") {
        return Response.json(mcpConfig({ github: mcpServer("GitHub MCP server", true) }));
      }
      if (path === "/api/mcp/config" && method === "PATCH") {
        return Response.json(mcpConfig({ github: mcpServer("GitHub MCP server", false) }));
      }
      if (path === "/api/mcp/config" && method === "PUT") {
        return Response.json(mcpConfig({ github: mcpServer("Edited GitHub MCP server", false) }));
      }
      if (path === "/api/mcp/cache/reset" && method === "POST") {
        return Response.json({
          success: true,
          message: "MCP tools cache reset. Tools will reload on next use.",
        });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "tools" } },
    });
    await waitForSelector(wrapper, '[data-testid="vue-settings-tools-list"]');

    expect(wrapper.get('[data-testid="vue-settings-tools-list"]').text()).toContain(
      "GitHub MCP server",
    );
    expect(wrapper.get('[data-testid="vue-settings-tools-tool-list-github"]').text()).toContain(
      "search",
    );
    expect(wrapper.get('[data-testid="vue-settings-tools-list"]').text()).toContain(
      "GITHUB_TOKEN",
    );
    expect(wrapper.get('[data-testid="vue-settings-tools-runtime-summary"]').text()).toContain(
      "已启用 1 / 1 个服务器",
    );
    expect(wrapper.get('[data-testid="vue-settings-tools-runtime-summary"]').text()).toContain(
      "stdio",
    );
    expect(wrapper.get('[data-testid="vue-settings-tools-runtime-summary"]').text()).toContain(
      "1",
    );
    expect(wrapper.get('[data-testid="vue-settings-tools-runtime-note"]').text()).toContain(
      "不代表 live 工具 schema 验收",
    );

    await wrapper.get('[data-testid="vue-settings-tools-toggle-github"]').setValue(false);
    await flushPromises();

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => requestPath(url) === "/api/mcp/config" && init?.method === "PATCH",
    );
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      enabled: false,
      server_name: "github",
    });
    expect(wrapper.get('[data-testid="vue-settings-tools-list"]').text()).toContain("已禁用");

    await wrapper.get('[data-testid="vue-settings-tools-reset-cache"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-settings-tools-reset-message"]').text()).toContain(
      "reload on next use",
    );

    await wrapper.get('[data-testid="vue-settings-tools-open-config"]').trigger("click");
    await flushPromises();
    await wrapper
      .get('[data-testid="vue-settings-tools-config-json"]')
      .setValue(JSON.stringify(mcpConfig({ github: mcpServer("Edited GitHub MCP server", false) })));
    await wrapper.get('[data-testid="vue-settings-tools-editor"]').trigger("submit");
    await flushPromises();

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) => requestPath(url) === "/api/mcp/config" && init?.method === "PUT",
    );
    expect(JSON.parse(String(putCall?.[1]?.body))).toEqual(
      mcpConfig({ github: mcpServer("Edited GitHub MCP server", false) }),
    );
    expect(wrapper.get('[data-testid="vue-settings-tools-list"]').text()).toContain(
      "Edited GitHub MCP server",
    );
  });

  it("shows the MCP admin-required state without retrying as a generic tools error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) =>
        requestPath(url) === "/api/mcp/config"
          ? Response.json(
              { detail: "Admin privileges required to manage MCP configuration." },
              { status: 403 },
            )
          : new Response(null, { status: 401 }),
      ),
    );
    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "tools" } },
    });
    await waitForSelector(wrapper, '[data-testid="vue-settings-tools-admin-required"]');

    expect(wrapper.get('[data-testid="vue-settings-tools-admin-required"]').text()).toContain(
      "管理员权限",
    );
  });

  it("shows a MCP config validation error before PUT", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = requestPath(url);
      const method = init?.method ?? "GET";
      if (path === "/api/v1/auth/me") {
        return new Response(null, { status: 401 });
      }
      if (path === "/api/mcp/config" && method === "GET") {
        return Response.json(mcpConfig({ github: mcpServer("GitHub MCP server", true) }));
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "tools" } },
    });
    await waitForSelector(wrapper, '[data-testid="vue-settings-tools-open-config"]');
    await wrapper.get('[data-testid="vue-settings-tools-open-config"]').trigger("click");
    await flushPromises();

    await wrapper.get('[data-testid="vue-settings-tools-config-json"]').setValue("{}");
    await wrapper.get('[data-testid="vue-settings-tools-editor"]').trigger("submit");
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-settings-tools-form-error"]').text()).toContain(
      "mcp_servers",
    );
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => requestPath(url) === "/api/mcp/config" && init?.method === "PUT",
      ),
    ).toBe(false);
  });

  it("loads, filters, and toggles skills through the Gateway skills contract for admins", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = requestPath(url);
      const method = init?.method ?? "GET";
      if (path === "/api/v1/auth/me") {
        return Response.json({
          id: "admin-1",
          email: "admin@example.com",
          system_role: "admin",
        });
      }
      if (path === "/api/skills" && method === "GET") {
        return Response.json({
          skills: [
            skillResponse("skill-reviewer", "public", true),
            skillResponse("custom-writer", "custom", true),
          ],
        });
      }
      if (path === "/api/skills/skill-reviewer" && method === "PUT") {
        return Response.json(skillResponse("skill-reviewer", "public", false));
      }
      if (path === "/api/skills/skill-reviewer" && method === "GET") {
        return Response.json(skillResponse("skill-reviewer", "public", true));
      }
      if (path === "/api/skills/reload" && method === "POST") {
        return Response.json({ success: true, scope: "process", message: "Skill caches invalidated." });
      }
      if (path === "/api/skills/install" && method === "POST") {
        return Response.json({ success: true, skill_name: "custom-writer", message: "Installed custom-writer." });
      }
      if (path === "/api/skills/custom/custom-writer" && method === "GET") {
        return Response.json({
          ...skillResponse("custom-writer", "custom", true),
          content: "# Custom writer",
        });
      }
      if (path === "/api/skills/custom/custom-writer" && method === "PUT") {
        return Response.json({
          ...skillResponse("custom-writer", "custom", true),
          content: "# Updated writer",
        });
      }
      if (path === "/api/skills/custom/custom-writer/history" && method === "GET") {
        return Response.json({ history: [{ action: "human_edit" }] });
      }
      if (path === "/api/skills/custom/custom-writer/rollback" && method === "POST") {
        return Response.json({
          ...skillResponse("custom-writer", "custom", true),
          content: "# Rolled back writer",
        });
      }
      if (path === "/api/skills/custom/custom-writer" && method === "DELETE") {
        return Response.json({ success: true });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "skills" } },
    });
    await waitForSelector(wrapper, '[data-testid="vue-settings-skills-list"]');

    expect(wrapper.get('[data-testid="vue-settings-skills-list"]').text()).toContain(
      "skill-reviewer",
    );
    expect(wrapper.get('[data-testid="vue-settings-skills-create-link"]').attributes("href")).toBe(
      "/workspace/chats/new?mode=skill",
    );
    expect(wrapper.get('[data-testid="vue-settings-skills-create-chat"]').attributes("href")).toBe(
      "/workspace/chats/new?mode=skill",
    );
    expect(wrapper.get('[data-testid="vue-settings-skills-list"]').text()).not.toContain(
      "custom-writer",
    );

    await wrapper.get('[data-testid="vue-settings-skills-create-name"]').setValue("custom-drafter");
    await wrapper
      .get('[data-testid="vue-settings-skills-create-description"]')
      .setValue("Drafts source-backed DeerFlow notes");
    await wrapper.get('[data-testid="vue-settings-skills-create-draft"]').trigger("click");
    await flushPromises();

    const draftContent = wrapper.get('[data-testid="vue-settings-skills-create-draft-content"]')
      .element as HTMLTextAreaElement;
    expect(draftContent.value).toContain("name: custom-drafter");
    expect(draftContent.value).toContain("description: Drafts source-backed DeerFlow notes");
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => requestPath(url) === "/api/skills/custom/custom-drafter" && init?.method === "POST",
      ),
    ).toBe(false);

    await wrapper.get('[data-testid="vue-settings-skills-reload"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-settings-skills-action-message"]').text()).toContain(
      "invalidated",
    );

    await wrapper.get('[data-testid="vue-settings-skills-install-thread"]').setValue("thread-1");
    await wrapper
      .get('[data-testid="vue-settings-skills-install-path"]')
      .setValue("mnt/user-data/outputs/custom.skill");
    await wrapper.get('[data-testid="vue-settings-skills-install-form"]').trigger("submit");
    await flushPromises();

    const installCall = fetchMock.mock.calls.find(
      ([url, init]) => requestPath(url) === "/api/skills/install" && init?.method === "POST",
    );
    expect(JSON.parse(String(installCall?.[1]?.body))).toEqual({
      path: "mnt/user-data/outputs/custom.skill",
      thread_id: "thread-1",
    });

    await wrapper.get('[data-testid="vue-settings-skills-detail-skill-reviewer"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-settings-skills-detail-panel"]').text()).toContain(
      "skill-reviewer",
    );

    await wrapper.get('[data-testid="vue-settings-skills-review-skill-reviewer"]').trigger("click");
    await flushPromises();
    expect(
      (wrapper.get('[data-testid="vue-settings-skills-review-target"]').element as HTMLInputElement)
        .value,
    ).toBe("skill://public/skill-reviewer");
    expect(
      (wrapper.get('[data-testid="vue-settings-skills-review-command"]').element as HTMLTextAreaElement)
        .value,
    ).toContain(
      "/skill-reviewer 审查 skill://public/skill-reviewer",
    );
    expect(wrapper.get('[data-testid="vue-settings-skills-review-panel"]').text()).toContain(
      "静态指令",
    );

    await wrapper.get('[data-testid="vue-settings-skills-filter-custom"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-settings-skills-list"]').text()).toContain(
      "custom-writer",
    );

    await wrapper.get('[data-testid="vue-settings-skills-review-custom-writer"]').trigger("click");
    await flushPromises();
    expect(
      (wrapper.get('[data-testid="vue-settings-skills-review-target"]').element as HTMLInputElement)
        .value,
    ).toBe("skill://custom/custom-writer");

    await wrapper.get('[data-testid="vue-settings-skills-edit-custom-writer"]').trigger("click");
    await flushPromises();
    const editorContent = wrapper.get('[data-testid="vue-settings-skills-editor-content"]')
      .element as HTMLTextAreaElement;
    expect(editorContent.value).toContain(
      "Custom writer",
    );

    await wrapper.get('[data-testid="vue-settings-skills-editor-content"]').setValue("# Updated writer");
    await wrapper.get('[data-testid="vue-settings-skills-editor"]').trigger("submit");
    await flushPromises();
    const customUpdateCall = fetchMock.mock.calls.find(
      ([url, init]) => requestPath(url) === "/api/skills/custom/custom-writer" && init?.method === "PUT",
    );
    expect(JSON.parse(String(customUpdateCall?.[1]?.body))).toEqual({
      content: "# Updated writer",
    });

    await wrapper.get('[data-testid="vue-settings-skills-history"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-settings-skills-history-panel"]').text()).toContain(
      "human_edit",
    );

    await wrapper.get('[data-testid="vue-settings-skills-rollback"]').trigger("click");
    await flushPromises();
    const customRollbackCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        requestPath(url) === "/api/skills/custom/custom-writer/rollback" &&
        init?.method === "POST",
    );
    expect(JSON.parse(String(customRollbackCall?.[1]?.body))).toEqual({ history_index: -1 });
    expect(
      (wrapper.get('[data-testid="vue-settings-skills-editor-content"]').element as HTMLTextAreaElement)
        .value,
    ).toContain("Rolled back writer");
    expect(wrapper.get('[data-testid="vue-settings-skills-action-message"]').text()).toContain(
      "已回滚",
    );

    await wrapper.get('[data-testid="vue-settings-skills-delete"]').trigger("click");
    await flushPromises();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => requestPath(url) === "/api/skills/custom/custom-writer" && init?.method === "DELETE",
      ),
    ).toBe(true);

    await wrapper.get('[data-testid="vue-settings-skills-filter-public"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="vue-settings-skills-toggle-skill-reviewer"]').setValue(false);
    await flushPromises();

    const updateCall = fetchMock.mock.calls.find(
      ([url, init]) => requestPath(url) === "/api/skills/skill-reviewer" && init?.method === "PUT",
    );
    expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({ enabled: false });
    expect(wrapper.get('[data-testid="vue-settings-skills-list"]').text()).toContain("已禁用");
  });

  it("keeps skill toggles readonly for non-admin users", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const path = requestPath(url);
        if (path === "/api/v1/auth/me") {
          return Response.json({
            id: "user-1",
            email: "user@example.com",
            system_role: "user",
          });
        }
        if (path === "/api/skills") {
          return Response.json({ skills: [skillResponse("skill-reviewer", "public", true)] });
        }
        return new Response("not found", { status: 404 });
      }),
    );
    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "skills" } },
    });
    await waitForSelector(wrapper, '[data-testid="vue-settings-skills-readonly"]');

    expect(wrapper.get('[data-testid="vue-settings-skills-toggle-skill-reviewer"]').attributes("disabled")).toBeDefined();
  });

  it("shows a skills admin-required error from the Gateway", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) =>
        requestPath(url) === "/api/skills"
          ? Response.json({ detail: "Admin privileges required to manage skills." }, { status: 403 })
          : new Response(null, { status: 401 }),
      ),
    );
    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "skills" } },
    });
    await waitForSelector(wrapper, '[data-testid="vue-settings-skills-admin-required"]');

    expect(wrapper.get('[data-testid="vue-settings-skills-admin-required"]').text()).toContain(
      "管理员权限",
    );
  });

  it("stores browser notification preferences and sends a test notification", async () => {
    const notifications: Array<{ body?: string; title: string }> = [];
    let testPermission: NotificationPermission = "default";
    const TestNotification = vi.fn(function testNotification(
      title: string,
      options?: NotificationOptions,
    ) {
      notifications.push({ body: options?.body, title });
    }) as unknown as typeof Notification;
    Object.defineProperty(TestNotification, "permission", {
      configurable: true,
      get: () => testPermission,
    });
    TestNotification.requestPermission = vi.fn(async () => {
      testPermission = "granted";
      return testPermission;
    });
    vi.stubGlobal("Notification", TestNotification);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));

    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "notification" } },
    });
    await waitForSelector(wrapper, '[data-testid="vue-settings-notification-status"]');

    expect(wrapper.get('[data-testid="vue-settings-notification-status"]').text()).toContain(
      "default",
    );

    await wrapper.get('[data-testid="vue-settings-notification-request"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-settings-notification-status"]').text()).toContain(
      "granted",
    );

    await wrapper.get('[data-testid="vue-settings-notification-toggle"]').setValue(false);
    await flushPromises();
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_PREFERENCES_KEY) ?? "{}")).toEqual({
      appearance: { locale: "en-US", theme: "system" },
      notification: { enabled: false },
    });

    await wrapper.get('[data-testid="vue-settings-notification-toggle"]').setValue(true);
    await wrapper.get('[data-testid="vue-settings-notification-test"]').trigger("click");
    await flushPromises();

    expect(notifications).toEqual([
      {
        body: "此浏览器已启用通知。",
        title: "DeerFlow 通知",
      },
    ]);
    expect(wrapper.get('[data-testid="vue-settings-notification-message"]').text()).toContain(
      "已发送",
    );
  });

  it("loads, configures, connects, and disconnects IM channels through Gateway contracts", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = requestPath(url);
      const method = init?.method ?? "GET";
      if (path === "/api/v1/auth/me") {
        return new Response(null, { status: 401 });
      }
      if (path === "/api/channels/providers" && method === "GET") {
        return Response.json({
          enabled: true,
          providers: [
            channelProvider("telegram", {
              auth_mode: "deep_link",
              configured: false,
              connectable: false,
              credential_fields: [
                channelCredentialField("bot_token", "Bot token", "password"),
                channelCredentialField("bot_username", "Bot username", "text"),
              ],
              credential_values: { bot_username: "deer_bot" },
              display_name: "Telegram",
              unavailable_reason: "Enter the required Telegram credentials to connect this channel.",
            }),
            channelProvider("slack", {
              auth_mode: "binding_code",
              configured: true,
              connectable: true,
              connection_status: "connected",
              display_name: "Slack",
            }),
          ],
        });
      }
      if (path === "/api/channels/connections" && method === "GET") {
        return Response.json({
          connections: [channelConnection("conn-1", "slack", "Slack User", "Acme")],
        });
      }
      if (path === "/api/channels/telegram/runtime-config" && method === "POST") {
        return Response.json(
          channelProvider("telegram", {
            auth_mode: "deep_link",
            configured: true,
            connectable: true,
            credential_fields: [
              channelCredentialField("bot_token", "Bot token", "password"),
              channelCredentialField("bot_username", "Bot username", "text"),
            ],
            credential_values: {
              bot_token: "********",
              bot_username: "deer_bot",
            },
            display_name: "Telegram",
          }),
        );
      }
      if (path === "/api/channels/telegram/connect" && method === "POST") {
        return Response.json({
          provider: "telegram",
          mode: "deep_link",
          url: "https://t.me/deer_bot?start=bind-code",
          code: "bind-code",
          instruction: "Send /start bind-code to the DeerFlow Telegram bot.",
          expires_in: 600,
        });
      }
      if (path === "/api/channels/slack/runtime-config" && method === "DELETE") {
        return Response.json(
          channelProvider("slack", {
            configured: false,
            connectable: false,
            display_name: "Slack",
          }),
        );
      }
      if (path === "/api/channels/connections/conn-1" && method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "channels" } },
    });
    await waitForSelector(wrapper, '[data-testid="vue-settings-channels-list"]');

    expect(wrapper.get('[data-testid="vue-settings-channel-slack"]').text()).toContain(
      "Slack User · Acme",
    );
    expect(wrapper.get('[data-testid="vue-settings-channel-telegram"]').text()).toContain(
      "未配置",
    );

    await wrapper.get('[data-testid="vue-settings-channel-connect-telegram"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="vue-settings-channel-config-form"]').exists()).toBe(true);
    await wrapper.get('[data-testid="vue-settings-channel-config-field-bot_token"]').setValue("token");
    await wrapper
      .get('[data-testid="vue-settings-channel-config-field-bot_username"]')
      .setValue("deer_bot");
    await wrapper.get('[data-testid="vue-settings-channel-config-form"]').trigger("submit");
    await flushPromises();

    const configureCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        requestPath(url) === "/api/channels/telegram/runtime-config" &&
        init?.method === "POST",
    );
    expect(JSON.parse(String(configureCall?.[1]?.body))).toEqual({
      values: {
        bot_token: "token",
        bot_username: "deer_bot",
      },
    });

    await wrapper.get('[data-testid="vue-settings-channel-connect-telegram"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-settings-channels-action-message"]').text()).toContain(
      "/start bind-code",
    );
    expect(wrapper.get('[data-testid="vue-settings-channels-connect-url"]').text()).toContain(
      "https://t.me/deer_bot",
    );

    await wrapper.get('[data-testid="vue-settings-channel-disconnect-slack"]').trigger("click");
    await flushPromises();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          requestPath(url) === "/api/channels/slack/runtime-config" && init?.method === "DELETE",
      ),
    ).toBe(true);

    await wrapper.get('[data-testid="vue-settings-channel-revoke-slack"]').trigger("click");
    await flushPromises();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          requestPath(url) === "/api/channels/connections/conn-1" && init?.method === "DELETE",
      ),
    ).toBe(true);
  });

  it("loads Lark integration status and installs the managed skill pack", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = requestPath(url);
      if (path === "/api/integrations/lark/status") {
        return Response.json(larkStatus({ installed: false, skills_installed: 0 }));
      }
      if (path === "/api/integrations/lark/install" && init?.method === "POST") {
        return Response.json({
          success: true,
          installed_skills: ["lark-docs"],
          message: "Installed Lark skill pack.",
          status: larkStatus({ installed: true, skills_installed: 1 }),
        });
      }
      if (path === "/api/integrations/lark/config/start" && init?.method === "POST") {
        return Response.json({
          verification_url: "https://lark.example/config",
          device_code: "config-device",
          expires_in: 300,
          interval: 5,
          user_code: "CFG1",
          brand: "lark",
        });
      }
      if (path === "/api/integrations/lark/config/complete" && init?.method === "POST") {
        return Response.json({
          success: true,
          message: "Configured Lark app.",
          status: larkStatus({ app_brand: "lark", app_configured: true }),
        });
      }
      if (path === "/api/integrations/lark/auth/start" && init?.method === "POST") {
        return Response.json({
          verification_url: "https://lark.example/auth",
          device_code: "auth-device",
          expires_in: 300,
          user_code: "AUTH1",
          hint: "Open the verification URL.",
        });
      }
      if (path === "/api/integrations/lark/auth/complete" && init?.method === "POST") {
        return Response.json({
          success: true,
          message: "Authorized Lark user.",
          status: larkStatus({
            auth: {
              status: "authenticated",
              message: null,
              user: "user@example.com",
              verified: true,
            },
          }),
        });
      }
      return new Response(null, { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(SettingsPage, {
      route: { path: "/workspace/settings", query: { settings: "integrations" } },
    });
    await waitForSelector(wrapper, '[data-testid="vue-settings-integrations-lark"]');

    expect(wrapper.get('[data-testid="vue-settings-integrations-lark"]').text()).toContain(
      "0 / 2",
    );

    await wrapper.get('[data-testid="vue-settings-integrations-lark-install"]').trigger("click");
    await flushPromises();

    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          requestPath(url) === "/api/integrations/lark/install" && init?.method === "POST",
      ),
    ).toBe(true);
    expect(wrapper.get('[data-testid="vue-settings-integrations-lark-action-message"]').text()).toContain(
      "Installed Lark skill pack.",
    );

    await wrapper.get('[data-testid="vue-settings-integrations-lark-config-open"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="vue-settings-integrations-lark-config-brand"]').setValue("lark");
    await wrapper
      .get('[data-testid="vue-settings-integrations-lark-config-start-form"]')
      .trigger("submit");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-settings-integrations-lark-config-result"]').text()).toContain(
      "CFG1",
    );
    const configStartCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        requestPath(url) === "/api/integrations/lark/config/start" &&
        init?.method === "POST",
    );
    expect(JSON.parse(String(configStartCall?.[1]?.body))).toEqual({ brand: "lark" });

    await wrapper
      .get('[data-testid="vue-settings-integrations-lark-config-complete-form"]')
      .trigger("submit");
    await flushPromises();
    const configCompleteCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        requestPath(url) === "/api/integrations/lark/config/complete" &&
        init?.method === "POST",
    );
    expect(JSON.parse(String(configCompleteCall?.[1]?.body))).toEqual({
      brand: "lark",
      device_code: "config-device",
      expires_in: 300,
      interval: 5,
    });
    expect(wrapper.get('[data-testid="vue-settings-integrations-lark-action-message"]').text()).toContain(
      "Configured Lark app.",
    );

    await wrapper.get('[data-testid="vue-settings-integrations-lark-auth-open"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="vue-settings-integrations-lark-auth-domains"]').setValue("docs, im");
    await wrapper.get('[data-testid="vue-settings-integrations-lark-auth-scope"]').setValue("custom.scope");
    await wrapper
      .get('[data-testid="vue-settings-integrations-lark-auth-start-form"]')
      .trigger("submit");
    await flushPromises();
    expect(wrapper.get('[data-testid="vue-settings-integrations-lark-auth-result"]').text()).toContain(
      "AUTH1",
    );
    const authStartCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        requestPath(url) === "/api/integrations/lark/auth/start" && init?.method === "POST",
    );
    expect(JSON.parse(String(authStartCall?.[1]?.body))).toEqual({
      domains: ["docs", "im"],
      recommend: true,
      scope: "custom.scope",
    });

    await wrapper.get('[data-testid="vue-settings-integrations-lark-auth-timeout"]').setValue("3");
    await wrapper
      .get('[data-testid="vue-settings-integrations-lark-auth-complete-form"]')
      .trigger("submit");
    await flushPromises();
    const authCompleteCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        requestPath(url) === "/api/integrations/lark/auth/complete" &&
        init?.method === "POST",
    );
    expect(JSON.parse(String(authCompleteCall?.[1]?.body))).toEqual({
      device_code: "auth-device",
      wait_timeout_seconds: 3,
    });
    expect(wrapper.get('[data-testid="vue-settings-integrations-lark-action-message"]').text()).toContain(
      "Authorized Lark user.",
    );
  });
});

async function waitForSelector(wrapper: Awaited<ReturnType<typeof mountSuspended>>, selector: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await flushPromises();
    if (wrapper.find(selector).exists()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for ${selector}`);
}

function requestPath(url: string | URL | Request): string {
  const rawUrl = url instanceof Request ? url.url : String(url);
  return rawUrl.startsWith("http") ? new URL(rawUrl).pathname : rawUrl;
}

function memoryFact(id: string, content: string, category: string, confidence: number) {
  return {
    id,
    category,
    confidence,
    content,
    createdAt: "2026-08-01T00:00:00Z",
    source: "manual",
  };
}

function memoryWithFacts(facts: Array<ReturnType<typeof memoryFact>>) {
  return {
    version: "1.0",
    lastUpdated: "2026-08-01T00:00:00Z",
    user: {
      workContext: { summary: "", updatedAt: "" },
      personalContext: { summary: "", updatedAt: "" },
      topOfMind: { summary: "", updatedAt: "" },
    },
    history: {
      recentMonths: { summary: "", updatedAt: "" },
      earlierContext: { summary: "", updatedAt: "" },
      longTermBackground: { summary: "", updatedAt: "" },
    },
    facts,
  };
}

function mcpServer(description: string, enabled: boolean) {
  return {
    args: ["--stdio"],
    command: "npx",
    description,
    enabled,
    env: { GITHUB_TOKEN: "***" },
    headers: {},
    routing: { keywords: ["repo"], mode: "prefer", priority: 20 },
    tools: {
      search: {
        routing: { keywords: ["issues"], mode: "prefer", priority: 30 },
      },
    },
    type: "stdio",
  };
}

function mcpConfig(servers: Record<string, ReturnType<typeof mcpServer>>) {
  return {
    mcp_servers: servers,
  };
}

function larkStatus(overrides: Partial<ReturnType<typeof larkStatusBase>> = {}) {
  return {
    ...larkStatusBase(),
    ...overrides,
  };
}

function larkStatusBase() {
  return {
    installed: true,
    version: "1.0.0",
    manifest_version: "1.0.0",
    latest_available_version: null,
    runtime_version_mismatch: false,
    app_configured: true,
    app_id: "cli_x",
    app_brand: "feishu",
    skills_expected: 2,
    skills_installed: 1,
    installed_skills: ["lark-docs"],
    enabled_skills: ["lark-docs"],
    install_path: "",
    cli: { available: true, path: null, version: "lark-cli 1.0.0", error: null },
    auth: { status: "authenticated", message: null, user: "user@example.com", verified: true },
    sandbox_runtime_mode: "broker",
    sandbox_runtime_ready: true,
    sandbox_runtime_detail: null,
  };
}

function skillResponse(name: string, category: "public" | "custom", enabled: boolean) {
  return {
    category,
    description: `${name} description`,
    editable: category === "custom",
    enabled,
    license: "MIT",
    name,
  };
}

function channelCredentialField(name: string, label: string, type: string) {
  return {
    name,
    label,
    required: true,
    type,
  };
}

function channelProvider(
  provider: string,
  overrides: Partial<ReturnType<typeof channelProviderBase>> = {},
) {
  return {
    ...channelProviderBase(provider),
    ...overrides,
  };
}

function channelProviderBase(provider: string) {
  return {
    auth_mode: "binding_code",
    configured: true,
    connectable: true,
    connection_status: "not_connected",
    credential_fields: [],
    credential_values: {},
    display_name: provider,
    enabled: true,
    provider,
    unavailable_reason: null,
  };
}

function channelConnection(
  id: string,
  provider: string,
  accountName: string,
  workspaceName: string,
) {
  return {
    id,
    external_account_id: "account-1",
    external_account_name: accountName,
    metadata: {},
    provider,
    scopes: [],
    status: "connected",
    workspace_id: "workspace-1",
    workspace_name: workspaceName,
  };
}
