/*
  由 scripts/rstest-to-vitest.mjs 从 frontend/tests/unit/core/skills/slash-contract.test.ts 机械生成。
  基线 27a425b0 · 改动仅限 @rstest/core → vitest、rs.* → vi.*。
  勿手改：make codemod-check 会红。需要为 Vue 侧适配就登记进 HAND_MAINTAINED。
*/

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  RESERVED_SLASH_SKILL_NAMES,
  SLASH_SKILL_RE,
} from "@/core/skills/slash";

interface ContractFile {
  reserved_slash_skill_names: string[];
  skill_name_pattern: string;
}

const CONTRACT_PATH = resolve(
  __dirname,
  "../../../../../contracts/slash_skill_contract.json",
);
const CONTRACT: ContractFile = JSON.parse(
  readFileSync(CONTRACT_PATH, "utf-8"),
) as ContractFile;

describe("slash-skill contract", () => {
  it("reserved names match the shared contract fixture", () => {
    expect([...RESERVED_SLASH_SKILL_NAMES].sort()).toEqual(
      [...CONTRACT.reserved_slash_skill_names].sort(),
    );
  });

  it("skill-name grammar matches the shared contract fixture", () => {
    // The contract stores the Python-canonical pattern (an unescaped `/`).
    // Normalize both through the RegExp constructor so the comparison is not
    // tripped by JS escaping the delimiter to `\/` in `.source`.
    expect(SLASH_SKILL_RE.source).toBe(
      new RegExp(CONTRACT.skill_name_pattern).source,
    );
  });
});
