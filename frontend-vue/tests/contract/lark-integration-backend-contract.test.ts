import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const backendIntegrationsSource = readRepositoryFile("backend/app/gateway/routers/integrations.py");
const vueLarkClientSource = readRepositoryFile(
  "frontend-vue/app/core/api/integrations/lark.ts",
);
const vueLarkComposableSource = readRepositoryFile(
  "frontend-vue/app/features/settings/integrations/use-lark-integration.ts",
);
const vueSettingsFeatureSource = readRepositoryFile(
  "frontend-vue/app/features/settings/integrations/use-settings-integrations.ts",
);
const vueSettingsWidgetSource = readRepositoryFile(
  "frontend-vue/app/widgets/workspace/settings/SettingsIntegrationsPanel.vue",
);

describe("Vue Lark integration settings match the real Gateway integration contract", () => {
  it("keeps Vue client endpoints aligned with the Lark integration router", () => {
    for (const route of [
      "/lark/status",
      "/lark/install",
      "/lark/config/start",
      "/lark/config/complete",
      "/lark/auth/start",
      "/lark/auth/complete",
    ]) {
      expect(backendIntegrationsSource).toContain(route);
    }
    expect(vueLarkClientSource).toContain('"/api/integrations/lark/status"');
    expect(vueLarkClientSource).toContain('"/api/integrations/lark/install"');
    expect(vueLarkClientSource).toContain('"/api/integrations/lark/config/start"');
    expect(vueLarkClientSource).toContain('"/api/integrations/lark/config/complete"');
    expect(vueLarkClientSource).toContain('"/api/integrations/lark/auth/start"');
    expect(vueLarkClientSource).toContain('"/api/integrations/lark/auth/complete"');
  });

  it("anchors status shape, admin install gate, and host-path redaction", () => {
    expect(backendIntegrationsSource).toContain("class LarkIntegrationStatusResponse(BaseModel):");
    expect(backendIntegrationsSource).toContain("installed: bool");
    expect(backendIntegrationsSource).toContain("skills_installed: int");
    expect(backendIntegrationsSource).toContain("sandbox_runtime_ready: bool");
    expect(backendIntegrationsSource).toContain("_ADMIN_REQUIRED_DETAIL");
    expect(backendIntegrationsSource).toContain("await require_admin_user(request, detail=_ADMIN_REQUIRED_DETAIL)");
    expect(backendIntegrationsSource).toContain("include_host_paths=await _is_admin_user(request)");
    expect(backendIntegrationsSource).toContain('cli = cli.model_copy(update={"path": None})');
    expect(backendIntegrationsSource).toContain('install_path=status.install_path if include_host_paths else ""');
    expect(vueLarkClientSource).toContain("isAdminRequired");
    expect(vueLarkClientSource).toContain("appendCsrfHeader");
    expect(vueLarkComposableSource).toContain("invalidateQueries({ queryKey: [\"skills\"] })");
    expect(vueLarkComposableSource).toContain("startLarkAuthorization");
    expect(vueLarkComposableSource).toContain("completeLarkAuthorization");
    expect(vueLarkComposableSource).toContain("startLarkConfiguration");
    expect(vueLarkComposableSource).toContain("completeLarkConfiguration");
  });

  it("exposes the integration as a scoped settings section instead of overloading MCP tools", () => {
    expect(vueSettingsFeatureSource).toContain("useLarkIntegration(enabled)");
    expect(vueSettingsFeatureSource).toContain("installSkillPack");
    expect(vueSettingsFeatureSource).toContain("startConfigWizard");
    expect(vueSettingsFeatureSource).toContain("completeAuthWizard");
    expect(vueSettingsWidgetSource).toContain("vue-settings-integrations-lark");
    expect(vueSettingsWidgetSource).toContain("vue-settings-integrations-lark-install");
    expect(vueSettingsWidgetSource).toContain("vue-settings-integrations-lark-config-dialog");
    expect(vueSettingsWidgetSource).toContain("vue-settings-integrations-lark-auth-dialog");
  });
});

function readRepositoryFile(path: string) {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../..", path), "utf8");
}
