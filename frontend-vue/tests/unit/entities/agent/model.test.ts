import { describe, expect, it } from "vitest";

import {
  DEFAULT_MODEL_VALUE,
  INHERIT_VALUE,
  parseAgentModelSettingsDraft,
  resolveEffectiveModel,
  selectionToThinkingEnabled,
  thinkingEnabledToSelection,
} from "../../../../app/entities/agent/model";

describe("agent gallery model helpers", () => {
  it("keeps inherit thinking state distinct from explicit off", () => {
    expect(thinkingEnabledToSelection(undefined)).toBe(INHERIT_VALUE);
    expect(thinkingEnabledToSelection(false)).toBe("off");
    expect(selectionToThinkingEnabled(INHERIT_VALUE)).toBeNull();
    expect(selectionToThinkingEnabled("on")).toBe(true);
  });

  it("resolves the first configured model for inherited defaults", () => {
    const models = [
      { name: "deep", display_name: "Deep", supports_thinking: true, supports_reasoning_effort: true },
      { name: "fast", display_name: "Fast", supports_thinking: false, supports_reasoning_effort: false },
    ];

    expect(resolveEffectiveModel(models, DEFAULT_MODEL_VALUE)?.name).toBe("deep");
    expect(resolveEffectiveModel(models, "fast")?.name).toBe("fast");
  });

  it("rejects invalid model settings without producing a request body", () => {
    expect(parseAgentModelSettingsDraft({ temperature: "2.1", maxTokens: "" })).toEqual({
      ok: false,
      error: "temperature",
    });
    expect(parseAgentModelSettingsDraft({ temperature: "", maxTokens: "200001" })).toEqual({
      ok: false,
      error: "max_tokens",
    });
    expect(parseAgentModelSettingsDraft({ temperature: "0.7", maxTokens: "100" })).toEqual({
      ok: true,
      modelSettings: { temperature: 0.7, max_tokens: 100 },
    });
  });
});
