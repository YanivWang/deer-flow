import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSkillSettings } from "../../../app/composables/use-skill-settings";

describe("useSkillSettings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("waits for the skills section to become active before loading skills", async () => {
    const fetchMock = vi.fn(async () => Response.json({ skills: [skill("public-skill")] }));
    vi.stubGlobal("fetch", fetchMock);
    const enabled = ref(false);
    const wrapper = mountSkillHarness(enabled);
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();

    enabled.value = true;
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/skills",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(wrapper.get('[data-testid="skills"]').text()).toBe("1");
  });

  it("updates the cached skill after toggling enabled state", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/skills" && !init?.method) {
        return Response.json({ skills: [skill("public-skill")] });
      }
      if (url === "/api/skills/public-skill" && init?.method === "PUT") {
        return Response.json(skill("public-skill", { enabled: false }));
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountSkillHarness(ref(true));
    await flushPromises();

    expect(wrapper.get('[data-testid="enabled"]').text()).toBe("true");
    await wrapper.get('[data-testid="toggle"]').trigger("click");
    await flushPromises();

    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ enabled: false });
    expect(wrapper.get('[data-testid="enabled"]').text()).toBe("false");
  });

  it("loads detail, updates custom skills, installs archives, reloads, and deletes", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/skills" && !init?.method) {
        return Response.json({ skills: [skill("custom-skill", { category: "custom", editable: true })] });
      }
      if (url === "/api/skills/custom-skill" && !init?.method) {
        return Response.json(skill("custom-skill", { category: "custom", editable: true }));
      }
      if (url === "/api/skills/custom/custom-skill" && !init?.method) {
        return Response.json(
          skill("custom-skill", { category: "custom", content: "# Skill", editable: true }),
        );
      }
      if (url === "/api/skills/custom/custom-skill" && init?.method === "PUT") {
        return Response.json(
          skill("custom-skill", { category: "custom", content: "# Updated", editable: true }),
        );
      }
      if (url === "/api/skills/custom/custom-skill/history" && !init?.method) {
        return Response.json({ history: [{ action: "human_edit" }] });
      }
      if (url === "/api/skills/custom/custom-skill/rollback" && init?.method === "POST") {
        return Response.json(
          skill("custom-skill", { category: "custom", content: "# Rolled back", editable: true }),
        );
      }
      if (url === "/api/skills/install" && init?.method === "POST") {
        return Response.json({ success: true, skill_name: "custom-skill", message: "installed" });
      }
      if (url === "/api/skills/reload" && init?.method === "POST") {
        return Response.json({ success: true, scope: "process", message: "reloaded" });
      }
      if (url === "/api/skills/custom/custom-skill" && init?.method === "DELETE") {
        return Response.json({ success: true });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountSkillHarness(ref(true));
    await flushPromises();

    await wrapper.get('[data-testid="detail"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="load-custom"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="update-custom"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="history"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="rollback"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="install"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="reload"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="delete-custom"]').trigger("click");
    await flushPromises();

    expect(fetchMock.mock.calls.some(([url]) => url === "/api/skills/reload")).toBe(true);
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          url === "/api/skills/custom/custom-skill/rollback" && init?.method === "POST",
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => url === "/api/skills/custom/custom-skill" && init?.method === "DELETE",
      ),
    ).toBe(true);
  });
});

function mountSkillHarness(enabled = ref(true)) {
  const Probe = defineComponent({
    setup() {
      const settings = useSkillSettings(enabled);
      return () =>
        h("div", [
          h("p", { "data-testid": "skills" }, String(settings.skills.value.length)),
          h(
            "p",
            { "data-testid": "enabled" },
            String(settings.skills.value[0]?.enabled ?? null),
          ),
          h(
            "button",
            {
              "data-testid": "toggle",
              onClick: () =>
                settings.setSkillEnabled({ enabled: false, skillName: "public-skill" }),
            },
            "toggle",
          ),
          h(
            "button",
            {
              "data-testid": "detail",
              onClick: () => settings.fetchSkillDetail("custom-skill"),
            },
            "detail",
          ),
          h(
            "button",
            {
              "data-testid": "load-custom",
              onClick: () => settings.fetchCustomSkill("custom-skill"),
            },
            "custom",
          ),
          h(
            "button",
            {
              "data-testid": "update-custom",
              onClick: () =>
                settings.updateCustomSkill({ content: "# Updated", skillName: "custom-skill" }),
            },
            "update",
          ),
          h(
            "button",
            {
              "data-testid": "history",
              onClick: () => settings.fetchCustomSkillHistory("custom-skill"),
            },
            "history",
          ),
          h(
            "button",
            {
              "data-testid": "rollback",
              onClick: () => settings.rollbackCustomSkill({ skillName: "custom-skill" }),
            },
            "rollback",
          ),
          h(
            "button",
            {
              "data-testid": "install",
              onClick: () =>
                settings.installSkill({
                  path: "mnt/user-data/outputs/custom.skill",
                  thread_id: "thread-1",
                }),
            },
            "install",
          ),
          h(
            "button",
            {
              "data-testid": "reload",
              onClick: () => settings.reloadSkills(),
            },
            "reload",
          ),
          h(
            "button",
            {
              "data-testid": "delete-custom",
              onClick: () => settings.deleteCustomSkill("custom-skill"),
            },
            "delete",
          ),
        ]);
    },
  });

  return mount(Probe, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
    },
  });
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function skill(name: string, overrides: Partial<ReturnType<typeof skillBase>> = {}) {
  return {
    ...skillBase(name),
    ...overrides,
  };
}

function skillBase(name: string) {
  return {
    category: "public",
    description: "Test skill",
    editable: false,
    enabled: true,
    license: "MIT",
    name,
  };
}
