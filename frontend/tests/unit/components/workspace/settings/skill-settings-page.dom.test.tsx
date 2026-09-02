import { afterEach, describe, expect, it, rs } from "@rstest/core";
import { cleanup, render, screen } from "@testing-library/react";

import { SkillSettingsPage } from "@/components/workspace/settings/skill-settings-page";

rs.mock("next/navigation", () => ({ useRouter: () => ({ push: rs.fn() }) }));

rs.mock("@/core/i18n/hooks", () => ({
  useI18n: () => ({
    t: {
      common: { loading: "Loading", public: "Public", custom: "Custom" },
      settings: {
        skills: {
          title: "Agent Skills",
          description: "Manage skills",
          createSkill: "Create skill",
          empty: "No skills",
          emptyDescription: "None yet",
        },
      },
    },
  }),
}));

rs.mock("@/core/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { system_role: "admin" } }),
}));

rs.mock("@/core/skills/hooks", () => ({
  useSkills: () => ({
    skills: [
      {
        name: "data-analysis",
        description: "Analyze data",
        category: "public",
        enabled: true,
      },
      {
        name: "frontend-design",
        description: "Design UI",
        category: "public",
        enabled: false,
      },
    ],
    isLoading: false,
    error: null,
  }),
  useEnableSkill: () => ({ mutate: rs.fn() }),
}));

rs.mock("@/env", () => ({
  env: { NEXT_PUBLIC_STATIC_WEBSITE_ONLY: "false" },
}));

// 每条用例后卸载：不卸载的话第二次 render 会和第一次的 DOM 叠在一起，
// `getByRole` 直接撞 "found multiple elements"，而那和产品无关。
afterEach(cleanup);

describe("SkillSettingsPage accessible names", () => {
  // A column of identical unnamed switches tells a screen reader nothing about
  // which skill it is toggling (WCAG 4.1.2).
  it("names each switch after its skill", () => {
    render(<SkillSettingsPage />);
    const names = screen
      .getAllByRole("switch")
      .map((node) => node.getAttribute("aria-label"));
    expect(names).toEqual(["data-analysis", "frontend-design"]);
    expect(new Set(names).size).toBe(names.length);
  });

  // An unnamed tab list is announced as a bare "tab list", which says nothing
  // about what it filters.
  it("names the public/custom tab list", () => {
    render(<SkillSettingsPage />);
    expect(screen.getByRole("tablist").getAttribute("aria-label")).toBe(
      "Agent Skills",
    );
  });
});
