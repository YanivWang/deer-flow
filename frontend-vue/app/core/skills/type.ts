/*
  【文件职责】     描述 Gateway SkillResponse 的 catalog 行。
  【架构位置】     L3 HTTP contract types
  【主要导出】     Skill
  【依赖关系】     无
  【边界与注意】   license 在真实 Gateway 可为 null；不得以旧 string-only 类型压扁。
*/

export interface Skill {
  name: string;
  description: string;
  category: string;
  license: string | null;
  enabled: boolean;
  editable: boolean;
}
