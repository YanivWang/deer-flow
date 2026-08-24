/*
  【文件职责】     固定 WP-09 Agent card 与 capability settings 的用户可见 DOM/exact payload。
  【架构位置】     WP-09 Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     AgentCard · AgentSettingsDialog · i18n
  【边界与注意】   badges 保序不去重；unsupported capability 提交 null 清除，不保留 stale override。
*/

import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AgentCard from "@/components/workspace/agents/AgentCard.vue";
import AgentSettingsDialog from "@/components/workspace/agents/AgentSettingsDialog.vue";
import type { Agent } from "@/core/agents/types";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Model } from "@/core/models/types";

const agent: Agent = {
  name: "reviewer",
  description: "Reviews code",
  model: "reasoning",
  tool_groups: ["browser", "file:read", "browser"],
  skills: ["review", "review", "long-skill-name"],
  model_settings: { temperature: 0, max_tokens: 200_000 },
  thinking_enabled: false,
  reasoning_effort: "high",
};

const models: Model[] = [
  {
    id: "basic",
    name: "basic",
    model: "provider/basic",
    display_name: "Basic",
    supports_thinking: false,
    supports_reasoning_effort: false,
  },
  {
    id: "reasoning",
    name: "reasoning",
    model: "provider/reasoning",
    display_name: "Reasoning",
    supports_thinking: true,
    supports_reasoning_effort: true,
  },
];

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: ref(enUS) } }));
});

afterEach(() => vi.unstubAllGlobals());

describe("AgentCard", () => {
  it("renders the exact model, ordered duplicate skills, and ordered duplicate groups", () => {
    const wrapper = mount(AgentCard, {
      props: { agent },
      global: { stubs: { NuxtLink: { template: "<a><slot /></a>" } } },
    });

    expect(wrapper.get('[data-testid="agent-model"]').text()).toBe("reasoning");
    expect(
      wrapper
        .findAll('[data-testid="agent-tool-group"]')
        .map((row) => row.text()),
    ).toEqual(["browser", "file:read", "browser"]);
    expect(
      wrapper.findAll('[data-testid="agent-skill"]').map((row) => row.text()),
    ).toEqual(["review", "review", "long-skill-name"]);
  });

  it("keeps null and empty tool-group filters visibly distinct", async () => {
    const wrapper = mount(AgentCard, {
      props: { agent: { ...agent, tool_groups: null } },
      global: { stubs: { NuxtLink: { template: "<a><slot /></a>" } } },
    });
    expect(wrapper.get('[data-testid="agent-tool-groups-all"]').text()).toBe(
      "All configured tool groups",
    );

    await wrapper.setProps({ agent: { ...agent, tool_groups: [] } });
    expect(wrapper.get('[data-testid="agent-tool-groups-none"]').text()).toBe(
      "No configured tool groups",
    );
  });
});

describe("AgentSettingsDialog", () => {
  it("emits false, zero, reasoning effort, and max tokens without truthy fallback", async () => {
    const wrapper = mount(AgentSettingsDialog, { props: { agent, models } });

    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("save")?.[0]?.[0]).toEqual({
      model: "reasoning",
      model_settings: { temperature: 0, max_tokens: 200_000 },
      thinking_enabled: false,
      reasoning_effort: "high",
    });
  });

  it("hides unsupported controls and emits null to clear their stale values", async () => {
    const wrapper = mount(AgentSettingsDialog, { props: { agent, models } });
    await wrapper.get('[data-testid="agent-settings-model"]').setValue("basic");

    expect(
      wrapper.find('[data-testid="agent-settings-thinking"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="agent-settings-reasoning"]').exists(),
    ).toBe(false);
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("save")?.[0]?.[0]).toMatchObject({
      model: "basic",
      thinking_enabled: null,
      reasoning_effort: null,
    });
  });

  it("submits number-input values through the actual save button", async () => {
    const wrapper = mount(AgentSettingsDialog, { props: { agent, models } });
    await wrapper.get('[data-testid="agent-settings-model"]').setValue("basic");
    await wrapper.get('[data-testid="agent-settings-temperature"]').setValue(0);
    await wrapper
      .get('[data-testid="agent-settings-max-tokens"]')
      .setValue(200000);
    await wrapper.get('[data-testid="agent-settings-save"]').trigger("click");

    expect(wrapper.emitted("save")?.[0]?.[0]).toEqual({
      model: "basic",
      model_settings: { temperature: 0, max_tokens: 200000 },
      thinking_enabled: null,
      reasoning_effort: null,
    });
  });

  it("keeps model/save failures visible and locks conflicting actions while pending", () => {
    const wrapper = mount(AgentSettingsDialog, {
      props: {
        agent,
        models,
        pending: true,
        modelError: "Failed to load model capabilities: Forbidden",
        submitError: "Failed to save model settings: Conflict",
      },
    });
    expect(wrapper.get('[role="alert"]').text()).toContain("Forbidden");
    expect(
      wrapper
        .findAll("button")
        .every((button) => (button.element as HTMLButtonElement).disabled),
    ).toBe(true);
  });
});
