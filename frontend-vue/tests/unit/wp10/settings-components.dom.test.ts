/*
  【文件职责】     固定 WP-10 Memory/Skills/MCP 设置页的预览确认、权限与 exact mutation DOM 行为。
  【对应 frontend/】 memory/skill/tool settings pages
  【架构位置】     WP-10 Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     Settings components · mocked query owners · i18n
  【边界与注意】   无效 import 必须零请求；普通用户只能读 skills 且不得触发 admin-only MCP I/O。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MemorySettings from "@/components/workspace/settings/MemorySettings.vue";
import SkillSettings from "@/components/workspace/settings/SkillSettings.vue";
import ToolSettings from "@/components/workspace/settings/ToolSettings.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { UserMemory } from "@/core/memory/types";

const memoryFactory = vi.hoisted(() => vi.fn());
const permissionsFactory = vi.hoisted(() => vi.fn());
const skillsFactory = vi.hoisted(() => vi.fn());
const mcpFactory = vi.hoisted(() => vi.fn());

vi.mock("@/composables/useMemory", () => ({ useMemory: memoryFactory }));
vi.mock("@/composables/useSettingsPermissions", () => ({
  useSettingsPermissions: permissionsFactory,
}));
vi.mock("@/composables/useSkillSettings", () => ({
  useSkillSettings: skillsFactory,
}));
vi.mock("@/composables/useMCPConfig", () => ({ useMCPConfig: mcpFactory }));
vi.mock("@/composables/useSettingsDialog", () => ({
  useSettingsDialog: () => ({ close: vi.fn() }),
}));

const memory: UserMemory = {
  version: "2.0",
  revision: 4,
  lastUpdated: "2026-08-22T00:00:00Z",
  user: {
    workContext: { summary: "Vue parity", updatedAt: "2026-08-22" },
    personalContext: { summary: "", updatedAt: "" },
    topOfMind: { summary: "WP-10", updatedAt: "2026-08-22" },
  },
  history: {
    recentMonths: { summary: "Settings", updatedAt: "2026-08-22" },
    earlierContext: { summary: "", updatedAt: "" },
    longTermBackground: { summary: "", updatedAt: "" },
  },
  facts: [
    {
      id: "fact-a",
      content: "Explicit zero is valid",
      category: "contract",
      confidence: 0.8,
      createdAt: "2026-08-22",
      source: "manual",
      revision: 2,
    },
  ],
};

function mutation(result: UserMemory = memory) {
  return {
    isPending: ref(false),
    error: ref<Error | null>(null),
    mutateAsync: vi.fn().mockResolvedValue(result),
  };
}

function memoryOwner() {
  return {
    memory: ref(memory),
    loading: ref(false),
    fetching: ref(false),
    error: ref<Error | null>(null),
    refetch: vi.fn(),
    clear: mutation(),
    create: mutation(),
    remove: mutation(),
    importDocument: mutation(),
    exportDocument: mutation(),
    update: mutation(),
  };
}

function permissions(admin: boolean) {
  const value = {
    state: "authenticated" as const,
    role: admin ? ("admin" as const) : ("user" as const),
    canReadSkills: true,
    canManageSkills: admin,
    canReadMcp: admin,
    canManageMcp: admin,
    adminRequired: !admin,
  };
  return {
    permissions: ref(value),
    canReadSkills: ref(true),
    canManageSkills: ref(admin),
    canReadMcp: ref(admin),
    canManageMcp: ref(admin),
  };
}

function selectFile(wrapper: ReturnType<typeof mount>, file: object) {
  const input = wrapper.get('[data-testid="memory-import-file"]');
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: [file],
  });
  return input.trigger("change");
}

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: ref(enUS) } }));
  vi.stubGlobal("navigateTo", vi.fn());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("MemorySettings", () => {
  it("rejects malformed and structurally invalid imports without a network request", async () => {
    const owner = memoryOwner();
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings);

    await selectFile(wrapper, {
      name: "malformed.json",
      text: vi.fn().mockResolvedValue("{oops"),
    });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("malformed-json");
    expect(owner.importDocument.mutateAsync).not.toHaveBeenCalled();

    await selectFile(wrapper, {
      name: "partial.json",
      text: vi.fn().mockResolvedValue(JSON.stringify({ version: "2.0" })),
    });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("missing-field");
    expect(owner.importDocument.mutateAsync).not.toHaveBeenCalled();
  });

  it("shows complete import preview and warnings before one confirmed request", async () => {
    const owner = memoryOwner();
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings);
    const imported = {
      ...memory,
      futureRoot: true,
      facts: [memory.facts[0], { ...memory.facts[0], id: "fact-b" }],
    };
    await selectFile(wrapper, {
      name: "memory.json",
      text: vi.fn().mockResolvedValue(JSON.stringify(imported)),
    });
    await flushPromises();

    const dialog = wrapper.get('[role="alertdialog"]');
    expect(dialog.text()).toContain("memory.json");
    expect(dialog.text()).toContain("2.0");
    expect(dialog.text()).toContain("2026-08-22T00:00:00Z");
    expect(
      wrapper.get('[data-testid="memory-import-extra-warning"]').text(),
    ).toContain("Gateway");
    expect(
      wrapper.get('[data-testid="memory-import-duplicate-warning"]').text(),
    ).toContain("different");
    expect(owner.importDocument.mutateAsync).not.toHaveBeenCalled();
    await dialog
      .findAll("button")
      .find((button) => button.text() === "Import")!
      .trigger("click");
    await flushPromises();
    expect(owner.importDocument.mutateAsync).toHaveBeenCalledTimes(1);
    expect(owner.importDocument.mutateAsync).toHaveBeenCalledWith(imported);
  });

  it("retains failed destructive dialogs and sends exact create/edit confidence zero", async () => {
    const owner = memoryOwner();
    owner.clear.mutateAsync.mockRejectedValue(new Error("Conflict detail"));
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings);

    await wrapper.get('[data-testid="memory-clear-open"]').trigger("click");
    await wrapper
      .get('[role="alertdialog"]')
      .findAll("button")[1]!
      .trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alertdialog"]').text()).toContain(
      "Conflict detail",
    );

    await wrapper
      .get('[role="alertdialog"]')
      .findAll("button")[0]!
      .trigger("click");
    await wrapper.get('[data-testid="memory-add-fact"]').trigger("click");
    await wrapper.get('[data-testid="memory-fact-content"]').setValue("Zero");
    await wrapper.get('[data-testid="memory-fact-confidence"]').setValue("0");
    await wrapper
      .get('[role="alertdialog"]')
      .findAll("button")[1]!
      .trigger("click");
    await flushPromises();
    expect(owner.create.mutateAsync).toHaveBeenCalledWith({
      content: "Zero",
      category: "context",
      confidence: 0,
    });

    await wrapper.get('button[aria-label^="Edit:"]').trigger("click");
    await wrapper.get('[data-testid="memory-fact-confidence"]').setValue("0");
    await wrapper
      .get('[role="alertdialog"]')
      .findAll("button")[1]!
      .trigger("click");
    await flushPromises();
    expect(owner.update.mutateAsync).toHaveBeenCalledWith({
      factId: "fact-a",
      input: { confidence: 0 },
    });
  });

  it("distinguishes a non-empty no-match search from fully empty memory", async () => {
    const owner = memoryOwner();
    memoryFactory.mockReturnValue(owner);
    const wrapper = mount(MemorySettings);
    await wrapper.get('[data-testid="memory-search"]').setValue("absent");
    expect(wrapper.find('[data-testid="memory-no-matches"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="memory-empty"]').exists()).toBe(false);
  });
});

describe("role-aware skill and MCP settings", () => {
  it("keeps ordinary-user skills readable but disables mutation and does not expose MCP data", () => {
    permissionsFactory.mockReturnValue(permissions(false));
    skillsFactory.mockReturnValue({
      skills: ref([
        {
          name: "review",
          description: "Review",
          category: "public",
          license: null,
          enabled: true,
          editable: false,
        },
      ]),
      loading: ref(false),
      error: ref(null),
      pending: ref(false),
      toggle: vi.fn(),
    });
    mcpFactory.mockReturnValue({
      config: ref(undefined),
      loading: ref(false),
      error: ref(null),
      mutationError: ref(null),
      pending: ref(false),
      toggle: vi.fn(),
    });
    const skill = mount(SkillSettings);
    expect(skill.text()).toContain("review");
    expect(skill.get('[role="switch"]').attributes("disabled")).toBeDefined();
    expect(skill.get('[data-testid="skills-admin-required"]').exists()).toBe(
      true,
    );
    const tool = mount(ToolSettings);
    expect(tool.get('[data-testid="mcp-admin-required"]').exists()).toBe(true);
    expect(tool.find('[role="switch"]').exists()).toBe(false);
  });

  it("lets admin toggle once while keeping server response ownership in the composable", async () => {
    permissionsFactory.mockReturnValue(permissions(true));
    const skillToggle = vi.fn().mockResolvedValue(undefined);
    const mcpToggle = vi.fn().mockResolvedValue(undefined);
    skillsFactory.mockReturnValue({
      skills: ref([
        {
          name: "review",
          description: "Review",
          category: "public",
          license: null,
          enabled: true,
          editable: false,
        },
      ]),
      loading: ref(false),
      error: ref(null),
      pending: ref(false),
      toggle: skillToggle,
    });
    mcpFactory.mockReturnValue({
      config: ref({
        mcp_servers: { docs: { enabled: true, description: "Docs" } },
      }),
      loading: ref(false),
      error: ref(null),
      mutationError: ref(null),
      pending: ref(false),
      toggle: mcpToggle,
    });
    const skill = mount(SkillSettings);
    await skill.get('[role="switch"]').setValue(false);
    expect(skillToggle).toHaveBeenCalledWith("review", false);
    const tool = mount(ToolSettings);
    await tool.get('[role="switch"]').setValue(false);
    expect(mcpToggle).toHaveBeenCalledWith("docs", false);
  });
});
