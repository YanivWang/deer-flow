/*
  【文件职责】     cmdk 的模糊匹配评分，逐行移植，供模型选择器筛选与排序。
  【架构位置】     L3（纯 TS）
  【主要导出】     commandScore
  【依赖关系】     无
  【边界与注意】   **这是 `cmdk@1.1.1` 的 `command-score` 的逐行移植，不是重写。**
                   上游 `frontend/src/components/ai-elements/model-selector.tsx`
                   把 `value={m.name}` 交给 cmdk，cmdk 的默认 filter 就是这个函数；
                   要和上游筛出同一批、排出同一序，只能用同一个算法。

                   **移植而不引依赖**：`cmdk` 是 React 组件库（本仓用 Reka），
                   而 `command-score` 没有可直接用的独立发布包。

                   **等价性是实测的**（2026-09-04，wave 62）：把本文件与
                   `cmdk@1.1.1` 的 `dist/command-score.js` 放在一起跑
                   19 个模型名 × 25 个查询 × 带/不带 aliases 两支 = **950 组，
                   逐值差 0**（判不等用 `Math.abs(a - b) > 1e-12`）。
                   那次比对是**一次性草稿脚本，没有签入**：它要 require
                   `../frontend/node_modules`，而 `make standalone-check`（P0）
                   正是禁止本模块引用兄弟应用的。签入的是
                   `tests/unit/models/command-score.test.ts` 里那批**从真实现取回来
                   的定值**——那些数字的出处就是上面这次比对。

                   **常量与四条正则一个都不能改。** 它们不是可调参数，是与上游同序的
                   前提；动任何一个，本仓的模型列表就会排出和 React 不同的顺序。

                   **`formatInput` 把 `[\s-]` 一律归成空格**，所以「照屏幕上的字打」
                   天然可用：列表显示 `display_name`（`MiniMax M3`）而评分的是
                   `name`（`minimax-m3`），两边归一后都是 `minimax m3`。
                   wave 37 那条「分隔符不敏感的子串匹配」因此被**完全覆盖**，
                   wave 62 已把它删掉，并留了专门用例钉住这一点。
*/

const SCORE_CONTINUE_MATCH = 1;
const SCORE_SPACE_WORD_JUMP = 0.9;
const SCORE_NON_SPACE_WORD_JUMP = 0.8;
const SCORE_CHARACTER_JUMP = 0.17;
const SCORE_TRANSPOSITION = 0.1;
const PENALTY_SKIPPED = 0.999;
const PENALTY_CASE_MISMATCH = 0.9999;
const PENALTY_NOT_COMPLETE = 0.99;

const IS_GAP_REGEXP = /[\\/_+.#"@[({&]/;
const COUNT_GAPS_REGEXP = /[\\/_+.#"@[({&]/g;
const IS_SPACE_REGEXP = /[\s-]/;
const COUNT_SPACE_REGEXP = /[\s-]/g;

function commandScoreInner(
  string: string,
  abbreviation: string,
  lowerString: string,
  lowerAbbreviation: string,
  stringIndex: number,
  abbreviationIndex: number,
  memoizedResults: Record<string, number>,
): number {
  if (abbreviationIndex === abbreviation.length) {
    return stringIndex === string.length
      ? SCORE_CONTINUE_MATCH
      : PENALTY_NOT_COMPLETE;
  }

  const memoKey = `${stringIndex},${abbreviationIndex}`;
  const memoized = memoizedResults[memoKey];
  if (memoized !== undefined) return memoized;

  const abbreviationChar = lowerAbbreviation.charAt(abbreviationIndex);
  let index = lowerString.indexOf(abbreviationChar, stringIndex);
  let highScore = 0;

  while (index >= 0) {
    let score = commandScoreInner(
      string,
      abbreviation,
      lowerString,
      lowerAbbreviation,
      index + 1,
      abbreviationIndex + 1,
      memoizedResults,
    );

    if (score > highScore) {
      if (index === stringIndex) {
        score *= SCORE_CONTINUE_MATCH;
      } else if (IS_GAP_REGEXP.test(string.charAt(index - 1))) {
        score *= SCORE_NON_SPACE_WORD_JUMP;
        const wordBreaks = string
          .slice(stringIndex, index - 1)
          .match(COUNT_GAPS_REGEXP);
        if (wordBreaks && stringIndex > 0) {
          score *= Math.pow(PENALTY_SKIPPED, wordBreaks.length);
        }
      } else if (IS_SPACE_REGEXP.test(string.charAt(index - 1))) {
        score *= SCORE_SPACE_WORD_JUMP;
        const spaceBreaks = string
          .slice(stringIndex, index - 1)
          .match(COUNT_SPACE_REGEXP);
        if (spaceBreaks && stringIndex > 0) {
          score *= Math.pow(PENALTY_SKIPPED, spaceBreaks.length);
        }
      } else {
        score *= SCORE_CHARACTER_JUMP;
        if (stringIndex > 0) {
          score *= Math.pow(PENALTY_SKIPPED, index - stringIndex);
        }
      }

      if (string.charAt(index) !== abbreviation.charAt(abbreviationIndex)) {
        score *= PENALTY_CASE_MISMATCH;
      }
    }

    if (
      (score < SCORE_TRANSPOSITION &&
        lowerString.charAt(index - 1) ===
          lowerAbbreviation.charAt(abbreviationIndex + 1)) ||
      (lowerAbbreviation.charAt(abbreviationIndex + 1) ===
        lowerAbbreviation.charAt(abbreviationIndex) &&
        lowerString.charAt(index - 1) !==
          lowerAbbreviation.charAt(abbreviationIndex))
    ) {
      const transposedScore = commandScoreInner(
        string,
        abbreviation,
        lowerString,
        lowerAbbreviation,
        index + 1,
        abbreviationIndex + 2,
        memoizedResults,
      );
      if (transposedScore * SCORE_TRANSPOSITION > score) {
        score = transposedScore * SCORE_TRANSPOSITION;
      }
    }

    if (score > highScore) highScore = score;
    index = lowerString.indexOf(abbreviationChar, index + 1);
  }

  memoizedResults[memoKey] = highScore;
  return highScore;
}

function formatInput(string: string): string {
  return string.toLowerCase().replace(COUNT_SPACE_REGEXP, " ");
}

/** 0 表示不匹配；越大越贴近。与 `cmdk@1.1.1` 的 `commandScore` 逐值相同。 */
export function commandScore(
  string: string,
  abbreviation: string,
  aliases?: string[],
): number {
  const haystack =
    aliases && aliases.length > 0 ? `${string} ${aliases.join(" ")}` : string;
  return commandScoreInner(
    haystack,
    abbreviation,
    formatInput(haystack),
    formatInput(abbreviation),
    0,
    0,
    {},
  );
}
