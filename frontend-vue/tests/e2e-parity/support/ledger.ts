/*
  【文件职责】     把对照台账摊平成「一处差异一行」，并算出一次 accept 会新增哪些行。
  【架构位置】     对照测试支持模块
  【主要导出】     DiffEntry · ledgerRows · addedRows
  【依赖关系】     无
  【边界与注意】   **抽出来是为了能被单测直接打**。这两个函数唯一的消费者是
                   `diff.spec.ts` 的 accept 分支，而那条分支只有在台账**将要变长**
                   时才会走到——台账当前是 0 行，跑真的 `make parity-accept`
                   永远走不到它。留在 spec 里就等于一段没人验过的逻辑
                   （wave 83/84 反复撞见的那一类）。

                   **判据是集合包含，不是行数。** 修好一条、同时新坏一条，
                   行数不变而台账里多了一行没人看过的东西——那正是 Makefile 里
                   那句「把回归洗白的按钮」说的样子。
*/

export type DiffEntry = {
  ariaOnlyReact: string[];
  ariaOnlyVue: string[];
  requestsOnlyReact: string[];
  requestsOnlyVue: string[];
  /** 锚点的几何与色板差异，一行一处。 */
  geometry: string[];
};

/** 摊平成 `场景键 · 字段: 那一行` 的形式，排序后返回。 */
export function ledgerRows(entries: Record<string, DiffEntry>): string[] {
  const rows: string[] = [];
  for (const [key, entry] of Object.entries(entries)) {
    for (const [field, lines] of Object.entries(entry)) {
      for (const line of lines) rows.push(`${key} · ${field}: ${line}`);
    }
  }
  return rows.sort();
}

/** `next` 里有、而 `previous` 里没有的行。空数组 = 这次 accept 只让台账变短。 */
export function addedRows(
  previous: Record<string, DiffEntry>,
  next: Record<string, DiffEntry>,
): string[] {
  const before = new Set(ledgerRows(previous));
  return ledgerRows(next).filter((row) => !before.has(row));
}
