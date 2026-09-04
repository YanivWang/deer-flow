/*
  【文件职责】     模型选择器的搜索：按 cmdk 的评分筛选并排序。
  【架构位置】     L3（纯 TS）
  【主要导出】     filterModelsByQuery
  【依赖关系】     ./command-score · ./types
  【边界与注意】   **判据字段跟着上游走**：`model-selector.tsx` 把 `value={m.name}`
                   交给 cmdk，cmdk 只拿这一个字段打分，所以这里也只看 `model.name`。
                   要改成也看 `display_name`，得先证明上游也这么做了——否则两边
                   会筛出不同的集合。

                   **空查询短路返回原数组。** `commandScore(x, "")` 是 **0.99** 而不是
                   0（用例里有哨兵），所以不短路的话空查询会「全部命中」。
                   **但那不会打乱顺序**——所有条目拿到的都是同一个 0.99，
                   下面的 index tiebreak 把原序原样保住。wave 62 变异实测：
                   删掉这一行**一条用例都不红**，它是一次**无效变异**（线索 170）。
                   **所以这条短路是省一次 O(n·m) 扫描，不是行为保证**——
                   别把它当判据写，也别为它编一条测不出来的用例。

                   入参收 `readonly Model[]`：调用点传的是 `props.models`
                   （Vue 的 props 是只读的），而空查询那一支要返回一个新数组，
                   否则类型上把只读数组当可变的往外递。

                   **排序必须稳定**：`Array.prototype.sort` 在 V8 上是稳定的，但
                   这里显式带上原始下标做 tiebreak，不依赖引擎保证——同分时保持
                   后端返回的顺序，与 cmdk 按 DOM 顺序落位的效果一致。
*/

import { commandScore } from "./command-score";
import type { Model } from "./types";

export function filterModelsByQuery(
  models: readonly Model[],
  query: string,
): Model[] {
  const trimmed = query.trim();
  if (!trimmed) return [...models];

  return models
    .map((model, index) => ({
      model,
      index,
      score: commandScore(model.name, trimmed),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) =>
      right.score === left.score
        ? left.index - right.index
        : right.score - left.score,
    )
    .map((entry) => entry.model);
}
