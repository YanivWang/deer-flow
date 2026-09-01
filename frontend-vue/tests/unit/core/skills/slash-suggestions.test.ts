/*
  【文件职责】     钉住斜杠建议目录的四条判据：查询解析、保留名、匹配面、名额分配。
  【架构位置】     L3 测试
  【依赖关系】     core/skills/slash-suggestions
  【边界与注意】   这四条在上游各有理由（见 slash-suggestions.ts 文件头），其中名额
                   分配那一条是两边同改后的新判据，只有直接对着 helper 断言才拦得住。
*/

import { describe, expect, it } from "vitest";

import { RESERVED_SLASH_SKILL_NAMES } from "@/core/skills/slash";
import {
  getLeadingSlashQuery,
  getMatchingSlashSuggestions,
  MAX_SLASH_SUGGESTIONS,
  type SlashSuggestion,
} from "@/core/skills/slash-suggestions";
import type { Skill } from "@/core/skills/type";

function makeSkill(name: string, enabled = true): Skill {
  return {
    name,
    description: `${name} description`,
    category: "public",
    license: null,
    enabled,
    editable: false,
  };
}

const builtins: SlashSuggestion[] = [
  {
    name: "goal",
    description: "Set, show, or clear an active goal",
    kind: "builtin",
  },
  {
    name: "compact",
    description: "Compact earlier context while keeping the full chat visible",
    kind: "builtin",
  },
];

describe("getLeadingSlashQuery", () => {
  it("returns the query for a leading slash token", () => {
    expect(getLeadingSlashQuery("/rev")).toBe("rev");
    expect(getLeadingSlashQuery("/")).toBe("");
  });

  it("returns null when there is no leading slash or the token is not bare", () => {
    expect(getLeadingSlashQuery("rev")).toBeNull();
    expect(getLeadingSlashQuery("/rev now")).toBeNull();
    expect(getLeadingSlashQuery("/goal ")).toBeNull();
    expect(getLeadingSlashQuery("/a/b")).toBeNull();
    expect(getLeadingSlashQuery("//foo")).toBeNull();
    expect(getLeadingSlashQuery("/a\nb")).toBeNull();
  });
});

describe("getMatchingSlashSuggestions", () => {
  it("drops disabled skills and ranks prefix matches ahead of the rest", () => {
    const result = getMatchingSlashSuggestions(
      [
        makeSkill("deep-review"),
        makeSkill("review"),
        makeSkill("reviewer", false),
      ],
      "rev",
      [],
    );

    expect(result.map((item) => item.name)).toEqual(["review", "deep-review"]);
    expect(result.every((item) => item.kind === "skill")).toBe(true);
  });

  it("keeps skills ahead of builtin commands", () => {
    const result = getMatchingSlashSuggestions(
      [makeSkill("goal-helper")],
      "goal",
      builtins,
    );

    expect(result.map((item) => `${item.kind}:${item.name}`)).toEqual([
      "skill:goal-helper",
      "builtin:goal",
    ]);
  });

  /*
    内建命令是产品自带的两条，用户记得住功能未必记得住拼写，所以说明也参与匹配。
    技能不参与：技能是用户自己装的，用说明模糊匹配会让 `/a` 命中一大片。
  */
  it("matches builtin commands by description but skills only by name", () => {
    const byDescription = getMatchingSlashSuggestions([], "context", builtins);
    expect(byDescription.map((item) => item.name)).toEqual(["compact"]);

    const skillByDescription = getMatchingSlashSuggestions(
      [makeSkill("frontend-design")],
      "description",
      [],
    );
    expect(skillByDescription).toEqual([]);
  });

  it("refuses skills named after a builtin command or a reserved name", () => {
    expect(
      getMatchingSlashSuggestions(
        [makeSkill("compact"), makeSkill("compact-helper")],
        "compact",
        builtins,
      ).map((item) => `${item.kind}:${item.name}`),
    ).toEqual(["skill:compact-helper", "builtin:compact"]);

    for (const reserved of RESERVED_SLASH_SKILL_NAMES) {
      const result = getMatchingSlashSuggestions(
        [makeSkill(reserved), makeSkill(`${reserved}-helper`)],
        reserved,
        builtins,
      );
      expect(
        result.filter((item) => item.kind === "skill").map((item) => item.name),
      ).toEqual([`${reserved}-helper`]);
    }
  });

  /*
    名额分配：内建命令先占位，技能填剩下的。上游是「技能先截满 6 条再拼内建再截 6」，
    于是启用技能 ≥6 个时 `/goal` 与 `/compact` 从列表里彻底消失。两边同改后仍然
    最多 6 条，只是被挤掉的换成了排在后面的技能。
  */
  it("reserves the matching builtin rows so ten skills cannot squeeze them out", () => {
    const skills = Array.from({ length: 10 }, (_, index) =>
      makeSkill(`skill-${index}`),
    );

    const result = getMatchingSlashSuggestions(skills, "", builtins);

    expect(result).toHaveLength(MAX_SLASH_SUGGESTIONS);
    expect(
      result.filter((item) => item.kind === "builtin").map((i) => i.name),
    ).toEqual(["goal", "compact"]);
    expect(
      result.filter((item) => item.kind === "skill").map((i) => i.name),
    ).toEqual(["skill-0", "skill-1", "skill-2", "skill-3"]);
  });

  it("still caps the list when no builtin command matches", () => {
    const skills = Array.from({ length: 10 }, (_, index) =>
      makeSkill(`skill-${index}`),
    );

    expect(getMatchingSlashSuggestions(skills, "", [])).toHaveLength(
      MAX_SLASH_SUGGESTIONS,
    );
  });
});
