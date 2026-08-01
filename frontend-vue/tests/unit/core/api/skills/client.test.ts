import { describe, expect, it, vi } from "vitest";

import {
  deleteCustomSkill,
  installSkill,
  loadCustomSkill,
  loadCustomSkillHistory,
  loadSkillDetail,
  loadSkills,
  reloadSkills,
  rollbackCustomSkill,
  updateCustomSkill,
  updateSkillEnabled,
  type SkillRequestError,
} from "../../../../../app/core/api/skills/client";

describe("skills API client", () => {
  it("loads skills from the Gateway route", async () => {
    const fetchMock = vi.fn(async () => Response.json({ skills: [skill("public-skill")] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadSkills()).resolves.toMatchObject([{ name: "public-skill" }]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/skills",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("updates one skill enabled state with JSON and CSRF headers", async () => {
    document.cookie = "csrf_token=skills-csrf";
    const fetchMock = vi.fn(async () => Response.json(skill("public-skill", { enabled: false })));
    vi.stubGlobal("fetch", fetchMock);

    await updateSkillEnabled("public/skill", false);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/skills/public%2Fskill",
      expect.objectContaining({
        body: JSON.stringify({ enabled: false }),
        credentials: "include",
        method: "PUT",
      }),
    );
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("X-CSRF-Token")).toBe(
      "skills-csrf",
    );
  });

  it("loads detail, manages custom skills, installs archives, and reloads caches", async () => {
    document.cookie = "csrf_token=skills-csrf";
    const fetchMock = vi.fn(async () => Response.json(skill("custom-skill", { category: "custom", editable: true })));
    vi.stubGlobal("fetch", fetchMock);

    await loadSkillDetail("custom/skill");
    await loadCustomSkill("custom/skill");
    await updateCustomSkill("custom/skill", "# Skill");
    await loadCustomSkillHistory("custom/skill");
    await rollbackCustomSkill("custom/skill");
    await deleteCustomSkill("custom/skill");
    await installSkill({ path: "mnt/user-data/outputs/custom.skill", thread_id: "thread-1" });
    await reloadSkills();

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "/api/skills/custom%2Fskill",
      "/api/skills/custom/custom%2Fskill",
      "/api/skills/custom/custom%2Fskill",
      "/api/skills/custom/custom%2Fskill/history",
      "/api/skills/custom/custom%2Fskill/rollback",
      "/api/skills/custom/custom%2Fskill",
      "/api/skills/install",
      "/api/skills/reload",
    ]);
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ content: "# Skill" }),
        method: "PUT",
      }),
    );
    expect(fetchMock.mock.calls[4]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({}),
        method: "POST",
      }),
    );
    expect(fetchMock.mock.calls[5]?.[1]).toEqual(expect.objectContaining({ method: "DELETE" }));
    expect(fetchMock.mock.calls[6]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          path: "mnt/user-data/outputs/custom.skill",
          thread_id: "thread-1",
        }),
        method: "POST",
      }),
    );
    expect(fetchMock.mock.calls[7]?.[1]).toEqual(expect.objectContaining({ method: "POST" }));
    expect((fetchMock.mock.calls[2]?.[1]?.headers as Headers).get("X-CSRF-Token")).toBe(
      "skills-csrf",
    );
  });

  it("marks 403 responses as admin-required errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ detail: "Admin privileges required to manage skills." }, { status: 403 }),
      ),
    );

    await expect(updateSkillEnabled("public-skill", true)).rejects.toMatchObject({
      isAdminRequired: true,
      message: "Admin privileges required to manage skills.",
      status: 403,
    } satisfies Partial<SkillRequestError>);
  });
});

function skill(
  name: string,
  overrides: Partial<ReturnType<typeof skillBase>> = {},
) {
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
