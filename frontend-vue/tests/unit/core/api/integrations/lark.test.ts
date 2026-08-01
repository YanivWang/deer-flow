import { describe, expect, it, vi } from "vitest";

import {
  completeLarkAuthorization,
  completeLarkConfiguration,
  installLarkIntegration,
  loadLarkIntegrationStatus,
  startLarkAuthorization,
  startLarkConfiguration,
} from "../../../../../app/core/api/integrations/lark";
import type { LarkIntegrationRequestError } from "../../../../../app/core/api/integrations/lark";

describe("Lark integration API client", () => {
  it("loads status and posts integration actions through Gateway endpoints", async () => {
    vi.stubGlobal("document", { cookie: "csrf_token=lark-token" });
    const status = larkStatus();
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(Response.json(status))
      .mockResolvedValueOnce(Response.json({ success: true, installed_skills: ["lark-docs"], message: "Installed", status }))
      .mockResolvedValueOnce(Response.json({ verification_url: "https://verify", device_code: "device-1", expires_in: 300, user_code: "ABCD", hint: "open" }))
      .mockResolvedValueOnce(Response.json({ verification_url: "https://config", device_code: "device-2", expires_in: 300, interval: 5, user_code: "EFGH", brand: "feishu" }))
      .mockResolvedValueOnce(Response.json({ success: true, message: "Configured", status }))
      .mockResolvedValueOnce(Response.json({ success: true, message: "Authorized", status }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadLarkIntegrationStatus()).resolves.toMatchObject({ installed: true });
    await installLarkIntegration();
    await startLarkAuthorization({ domains: ["docs"], recommend: true });
    await startLarkConfiguration({ brand: "feishu" });
    await completeLarkConfiguration({ brand: "feishu", device_code: "device-2", interval: 5 });
    await completeLarkAuthorization({ device_code: "device-1", wait_timeout_seconds: 2 });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/integrations/lark/status",
      "/api/integrations/lark/install",
      "/api/integrations/lark/auth/start",
      "/api/integrations/lark/config/start",
      "/api/integrations/lark/config/complete",
      "/api/integrations/lark/auth/complete",
    ]);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
    for (const [, init] of fetchMock.mock.calls.slice(1)) {
      expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe("lark-token");
    }
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ domains: ["docs"], recommend: true }),
        method: "POST",
      }),
    );
  });

  it("surfaces backend detail and admin-required status", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ detail: "Admin privileges required to install integrations." }, { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(installLarkIntegration()).rejects.toMatchObject({
      isAdminRequired: true,
      message: "Admin privileges required to install integrations.",
      status: 403,
    } satisfies Partial<LarkIntegrationRequestError>);
  });
});

function larkStatus() {
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
