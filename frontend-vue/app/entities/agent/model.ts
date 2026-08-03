export const AGENT_NAME_RE = /^[A-Za-z0-9-]+$/;
export const DEFAULT_MODEL_VALUE = "__default__";
export const INHERIT_VALUE = "__inherit__";
export const MAX_AGENT_OUTPUT_TOKENS = 200_000;

export type AgentModelSettings = {
  temperature?: number | null;
  max_tokens?: number | null;
};

export type AgentModelProfile = {
  name: string;
  display_name: string | null;
  supports_thinking: boolean;
  supports_reasoning_effort: boolean;
};

export type ThinkingSelection = typeof INHERIT_VALUE | "on" | "off";

export type NewAgentRunContext = {
  agent_name: string;
  is_bootstrap: true;
  is_plan_mode: false;
  mode: "flash";
  subagent_enabled: false;
  thinking_enabled: false;
};

export function buildNewAgentRunContext(agentName: string): NewAgentRunContext {
  return {
    agent_name: agentName,
    is_bootstrap: true,
    is_plan_mode: false,
    mode: "flash",
    subagent_enabled: false,
    thinking_enabled: false,
  };
}

export function thinkingEnabledToSelection(value: boolean | null | undefined): ThinkingSelection {
  if (value == null) return INHERIT_VALUE;
  return value ? "on" : "off";
}

export function selectionToThinkingEnabled(selection: ThinkingSelection): boolean | null {
  if (selection === "on") return true;
  if (selection === "off") return false;
  return null;
}

export function resolveEffectiveModel(
  models: AgentModelProfile[],
  modelValue: string,
): AgentModelProfile | undefined {
  if (modelValue === DEFAULT_MODEL_VALUE) return models[0];
  return models.find((model) => model.name === modelValue);
}

export type AgentSettingsValidationError = "temperature" | "max_tokens";

export type ParsedAgentModelSettings =
  | { ok: true; modelSettings: AgentModelSettings | null }
  | { ok: false; error: AgentSettingsValidationError };

export function parseAgentModelSettingsDraft(input: {
  temperature: string;
  maxTokens: string;
}): ParsedAgentModelSettings {
  const temperatureText = input.temperature.trim();
  const maxTokensText = input.maxTokens.trim();
  let temperature: number | null = null;
  let maxTokens: number | null = null;

  if (temperatureText) {
    temperature = Number(temperatureText);
    if (Number.isNaN(temperature) || temperature < 0 || temperature > 2) {
      return { ok: false, error: "temperature" };
    }
  }
  if (maxTokensText) {
    maxTokens = Number(maxTokensText);
    if (
      !Number.isInteger(maxTokens) ||
      maxTokens < 1 ||
      maxTokens > MAX_AGENT_OUTPUT_TOKENS
    ) {
      return { ok: false, error: "max_tokens" };
    }
  }

  return {
    ok: true,
    modelSettings:
      temperature === null && maxTokens === null
        ? null
        : { temperature, max_tokens: maxTokens },
  };
}
