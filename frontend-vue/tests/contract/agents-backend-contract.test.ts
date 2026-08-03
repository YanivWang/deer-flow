import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildNewAgentRunContext } from "../../app/entities/agent/model";

const gatewayServicesSource = readRepositoryFile("backend/app/gateway/services.py");
const leadAgentSource = readRepositoryFile(
  "backend/packages/harness/deerflow/agents/lead_agent/agent.py",
);
const agentsRouterSource = readRepositoryFile("backend/app/gateway/routers/agents.py");
const vueNewAgentSource = readRepositoryFile(
  "frontend-vue/app/features/agents/new/use-new-agent.ts",
);
const vueAgentModelSource = readRepositoryFile("frontend-vue/app/entities/agent/model.ts");

describe("Vue custom-agent builder matches the real backend bootstrap contract", () => {
  it("forwards bootstrap context keys that Gateway admits into runtime config", () => {
    expect(gatewayServicesSource).toContain('"mode"');
    expect(gatewayServicesSource).toContain('"thinking_enabled"');
    expect(gatewayServicesSource).toContain('"is_plan_mode"');
    expect(gatewayServicesSource).toContain('"subagent_enabled"');
    expect(gatewayServicesSource).toContain('"agent_name"');
    expect(gatewayServicesSource).toContain('"is_bootstrap"');
    expect(gatewayServicesSource).toContain("for section in (\"configurable\", \"context\")");
    expect(vueNewAgentSource).toContain("buildNewAgentRunContext(agentName.value)");
    expect(buildNewAgentRunContext("researcher")).toEqual({
      agent_name: "researcher",
      is_bootstrap: true,
      is_plan_mode: false,
      mode: "flash",
      subagent_enabled: false,
      thinking_enabled: false,
    });
  });

  it("keeps bootstrap runs on the setup_agent path instead of loading a missing custom agent", () => {
    expect(leadAgentSource).toContain('is_bootstrap = cfg.get("is_bootstrap", False)');
    expect(leadAgentSource).toContain(
      "agent_config = load_agent_config(agent_name, user_id=resolved_user_id) if not is_bootstrap else None",
    );
    expect(leadAgentSource).toContain("raw_tools = get_available_tools");
    expect(leadAgentSource).toContain("+ [setup_agent]");
    expect(leadAgentSource).toContain("if is_bootstrap:");
    expect(leadAgentSource).toContain("s.name in _BOOTSTRAP_SKILL_NAMES");
    expect(vueNewAgentSource).toContain("saveCommandMessage");
    expect(vueNewAgentSource).toContain("setup_agent");
    expect(vueNewAgentSource).toContain("hide_from_ui: true");
  });

  it("keeps name validation and normalized readback aligned with the agents router", () => {
    expect(agentsRouterSource).toContain('AGENT_NAME_PATTERN = re.compile(r"^[A-Za-z0-9-]+$")');
    expect(agentsRouterSource).toContain("return name.lower()");
    expect(agentsRouterSource).toContain('return {"available": not exists, "name": normalized}');
    expect(vueAgentModelSource).toContain("const AGENT_NAME_RE = /^[A-Za-z0-9-]+$/");
    expect(vueNewAgentSource).toContain("agentName.value = result.name || trimmed");
    expect(vueNewAgentSource).toContain("getAgentWithRetry(agentName.value");
  });
});

function readRepositoryFile(path: string) {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../..", path), "utf8");
}
