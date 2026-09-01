/*
  【文件职责】     `/` 打开的斜杠建议目录：解析查询串、按上游判据筛选与排序。
  【架构位置】     L3
  【主要导出】     MAX_SLASH_SUGGESTIONS · SlashSuggestion · getLeadingSlashQuery ·
                   getMatchingSlashSuggestions
  【依赖关系】     skills/slash（保留名）· skills/type
  【边界与注意】   与 React 的 getLeadingSlashSkillQuery / getMatchingSkillSuggestions
                   （frontend/src/components/workspace/input-box-helpers.ts）同判据。
                   抽成独立模块而不是留在 ChatComposer 里，是因为这一簇判据有四条
                   （保留名、内建命令按说明匹配、startsWith 优先、名额上限），每一条
                   都值得单测直接钉住；写在 SFC 的 computed 里只能靠挂载整个输入框
                   去间接验证。

                   **内建命令按 name 或 description 匹配，技能只按 name。** 这不是
                   疏漏：技能是用户自己装的，名字就是它的标识，用说明去模糊匹配会
                   让 `/a` 命中一大片；而 `/goal` `/compact` 是产品自带的两条，用户
                   记得住功能未必记得住拼写，所以 `/context` 也应当找得到 compact。

                   名额上限那一条与上游**有意不同**，两边同改（2026-09-02 用户拍板）：
                   上游是「技能先截到 6，再拼内建，再整体截到 6」，于是启用技能 ≥6 个
                   时 `/goal` 与 `/compact` 从列表里彻底消失，只能靠盲打。这里改成
                   **先给匹配到的内建命令留位置，技能填剩下的名额**，总数仍不超过 6。
                   顺序不变（技能在前、内建在后），所以默认目录下渲染结果一字不差。
*/

import { RESERVED_SLASH_SKILL_NAMES } from "./slash";
import type { Skill } from "./type";

export const MAX_SLASH_SUGGESTIONS = 6;

export type SlashSuggestion = {
  name: string;
  description: string;
  kind: "builtin" | "skill";
};

/**
 * 取出行首 `/` 后面的查询串；这一行不是一次斜杠查询时返回 null。
 *
 * 拒绝含空白与含 `/` 的查询：前者说明命令已经打完、后面跟的是参数（`/goal 写文档`
 * 不该再弹目录），后者说明这根本不是一个技能名（`//foo`）。
 */
export function getLeadingSlashQuery(value: string): string | null {
  if (!value.startsWith("/")) return null;
  const query = value.slice(1);
  if (query.includes("/") || /\s/.test(query)) return null;
  return query;
}

export function getMatchingSlashSuggestions(
  skills: readonly Skill[],
  query: string,
  builtinCommands: readonly SlashSuggestion[],
): SlashSuggestion[] {
  const normalizedQuery = query.toLowerCase();
  /*
    解析器拒绝的名字也不能出现在这里。两个斜杠解析器都丢弃
    RESERVED_SLASH_SKILL_NAMES，内建命令在输入框里自己拥有这些名字，所以叫这些
    名字的技能是**够不着**的：提交它要么运行了命令，要么原样当聊天文本发出去。
  */
  const reservedNames = new Set([
    ...RESERVED_SLASH_SKILL_NAMES,
    ...builtinCommands.map(({ name }) => name.toLowerCase()),
  ]);

  const builtinMatches = builtinCommands.filter(
    ({ name, description }) =>
      !normalizedQuery ||
      name.toLowerCase().includes(normalizedQuery) ||
      description.toLowerCase().includes(normalizedQuery),
  );

  const skillMatches = skills
    .map((skill, index) => ({ skill, index, name: skill.name.toLowerCase() }))
    .filter(
      ({ skill, name }) =>
        skill.enabled &&
        !reservedNames.has(name) &&
        (!normalizedQuery || name.includes(normalizedQuery)),
    )
    .sort((a, b) => {
      const aStartsWith = a.name.startsWith(normalizedQuery);
      const bStartsWith = b.name.startsWith(normalizedQuery);
      if (aStartsWith !== bStartsWith) return aStartsWith ? -1 : 1;
      return a.index - b.index;
    })
    // 内建命令的位置先扣掉，剩下的才是技能的名额。
    .slice(0, Math.max(0, MAX_SLASH_SUGGESTIONS - builtinMatches.length))
    .map(({ skill }) => ({
      name: skill.name,
      description: skill.description,
      kind: "skill" as const,
    }));

  return [...skillMatches, ...builtinMatches];
}
