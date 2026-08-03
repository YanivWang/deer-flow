import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLarkIntegration } from "../../../../../app/features/settings/integrations/use-lark-integration";

describe("useLarkIntegration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads only when enabled and updates cached status after install", async () => {
    let installed = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/integrations/lark/status" && init?.method === "GET") {
        return Response.json(
          larkStatus({
            installed,
            skills_installed: installed ? 1 : 0,
          }),
        );
      }
      if (url === "/api/integrations/lark/install" && init?.method === "POST") {
        installed = true;
        return Response.json({
          success: true,
          installed_skills: ["lark-docs"],
          message: "Installed Lark",
          status: larkStatus({ installed: true, skills_installed: 1 }),
        });
      }
      if (url === "/api/integrations/lark/config/start" && init?.method === "POST") {
        return Response.json({
          verification_url: "https://verify/config",
          device_code: "config-device",
          expires_in: 300,
          interval: 5,
          user_code: "CFG",
          brand: "feishu",
        });
      }
      if (url === "/api/integrations/lark/config/complete" && init?.method === "POST") {
        return Response.json({
          success: true,
          message: "Configured Lark",
          status: larkStatus({ app_configured: true, app_brand: "feishu" }),
        });
      }
      if (url === "/api/integrations/lark/auth/start" && init?.method === "POST") {
        return Response.json({
          verification_url: "https://verify/auth",
          device_code: "auth-device",
          expires_in: 300,
          user_code: "AUTH",
          hint: "open",
        });
      }
      if (url === "/api/integrations/lark/auth/complete" && init?.method === "POST") {
        return Response.json({
          success: true,
          message: "Authorized Lark",
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
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const enabled = ref(false);
    const wrapper = mountLarkHarness(enabled);
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();

    enabled.value = true;
    await flushPromises();
    expect(wrapper.get('[data-testid="installed"]').text()).toBe("false");

    await wrapper.get('[data-testid="install"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="installed"]').text()).toBe("true");
    expect(wrapper.get('[data-testid="message"]').text()).toBe("Installed Lark");

    await wrapper.get('[data-testid="start-config"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="device-code"]').text()).toBe("config-device");

    await wrapper.get('[data-testid="complete-config"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="message"]').text()).toBe("Configured Lark");

    await wrapper.get('[data-testid="start-auth"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="device-code"]').text()).toBe("auth-device");

    await wrapper.get('[data-testid="complete-auth"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="message"]').text()).toBe("Authorized Lark");
  });

  it("marks install 403 as admin-required", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/integrations/lark/status" && init?.method === "GET") {
        return Response.json(larkStatus());
      }
      return Response.json(
        { detail: "Admin privileges required to install integrations." },
        { status: 403 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountLarkHarness(ref(true));
    await flushPromises();

    await wrapper.get('[data-testid="install"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="install-admin"]').text()).toBe("true");
    expect(wrapper.get('[data-testid="mutation-error"]').text()).toContain("Admin privileges");
  });
});

function mountLarkHarness(enabled = ref(true)) {
  const Probe = defineComponent({
    setup() {
      const integration = useLarkIntegration(enabled);
      const message = ref("");
      const deviceCode = ref("");
      async function install() {
        try {
          const result = await integration.install();
          message.value = result.message;
        } catch {
          // Expected by admin-required error tests.
        }
      }
      async function startConfig() {
        const result = await integration.startConfig({ brand: "feishu" });
        deviceCode.value = result.device_code;
      }
      async function completeConfig() {
        const result = await integration.completeConfig({ brand: "feishu", device_code: "config-device" });
        message.value = result.message;
      }
      async function startAuth() {
        const result = await integration.startAuth({ domains: ["docs"], recommend: true });
        deviceCode.value = result.device_code;
      }
      async function completeAuth() {
        const result = await integration.completeAuth({ device_code: "auth-device", wait_timeout_seconds: 2 });
        message.value = result.message;
      }
      return () =>
        h("div", [
          h("p", { "data-testid": "installed" }, String(integration.status.value?.installed)),
          h("p", { "data-testid": "install-admin" }, String(integration.installAdminRequired.value)),
          h("p", { "data-testid": "mutation-error" }, integration.mutationErrorMessage.value),
          h("p", { "data-testid": "message" }, message.value),
          h("p", { "data-testid": "device-code" }, deviceCode.value),
          h("button", { "data-testid": "install", onClick: install }, "install"),
          h("button", { "data-testid": "start-config", onClick: startConfig }, "start-config"),
          h("button", { "data-testid": "complete-config", onClick: completeConfig }, "complete-config"),
          h("button", { "data-testid": "start-auth", onClick: startAuth }, "start-auth"),
          h("button", { "data-testid": "complete-auth", onClick: completeAuth }, "complete-auth"),
        ]);
    },
  });

  return mount(Probe, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
    },
  });
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

