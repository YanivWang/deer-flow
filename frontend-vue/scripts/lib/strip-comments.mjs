/*
  【文件职责】     把源码里的注释替换成空格，**认得出字符串**，供各扫描器共用。
  【架构位置】     构建脚本共享库
  【主要导出】     stripComments
  【依赖关系】     无
  【边界与注意】   **抽出来是因为 wave 84 撞见了它的一个正则版孪生兄弟。**
                   `tests/guards/file-header-claims.test.ts` 自己写过一份
                   `source.replace(/\/\*[\s\S]*?\*\//g, "")`——**不认字符串**，
                   于是 `config/routes.ts` 里的 `"/workspace/**"` 开了一个假注释，
                   一口吃掉 1886 个字符（连 `export function buildProxyRules` 一起）。
                   扫描面内有 **8** 份文件的字符串里带 `/*`，也就是说那条门禁一直
                   在半截源码上工作：`【主要导出】` 那一半会误报（吵，但看得见），
                   `【依赖关系】 无` 那一半会**静默放过**——被吃掉的 import 不会被数到。

                   这份实现按字符走，跟踪 `'` / `"` / 反引号与转义，因此不会被
                   字符串里的 `/*` 骗到。**已知残留**：正则字面量里的引号
                   （`/["']/`）仍会被当成字符串开头。实测扫描面内没有这种写法；
                   真遇到时**要把它补成解析，不要缩小扫描面**。

                   保留行号与列宽（注释内容换成空格、换行不动），所以调用方
                   既能判「这行还有代码吗」，又能按原行号定位。
*/

/**
 * 把注释内容替换成空格，保留行号与列宽。
 * 这样同一次扫描既能判定「这行还有代码级引用吗」，又能定位原始行。
 */
export function stripComments(source, styles) {
  const out = source.split("");
  const has = (style) => styles.includes(style);
  let i = 0;
  let state = "code";
  let quote = "";
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k += 1) {
      if (out[k] !== "\n") out[k] = " ";
    }
  };
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    const four = source.slice(i, i + 4);
    if (state === "code") {
      const ch = source[i];
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        state = "string";
        i += 1;
        continue;
      }
      if (has("block") && two === "/*") {
        const end = source.indexOf("*/", i + 2);
        const stop = end === -1 ? source.length : end + 2;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (has("html") && four === "<!--") {
        const end = source.indexOf("-->", i + 4);
        const stop = end === -1 ? source.length : end + 3;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (has("line") && two === "//") {
        const end = source.indexOf("\n", i);
        const stop = end === -1 ? source.length : end;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (has("hash") && ch === "#") {
        const end = source.indexOf("\n", i);
        const stop = end === -1 ? source.length : end;
        blank(i, stop);
        i = stop;
        continue;
      }
      i += 1;
      continue;
    }
    // state === "string"
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === quote) {
      state = "code";
      quote = "";
    }
    i += 1;
  }
  return out.join("");
}
