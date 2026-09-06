/*
  【文件职责】     从兄弟目录 `../backend` 读一份源码，并把「后端整个不在 checkout 里」
                   与「那份文件被挪走了」分成两种结果。
  【架构位置】     构建脚本共享库
  【主要导出】     backendRoot · readBackendSource
  【依赖关系】     node:fs · node:url
  【边界与注意】   为什么需要它：`doc-facts` 原来直接
                   `try { read("../backend/…") } catch { return }`——**这两件事被
                   压成了一件**。后端把那份文件改个名，`catch` 一样吃掉，用例照常绿，
                   而它守的那条断言从此不再被检查，没有任何征兆（wave 107）。
                   这里把它们分开：后端不在 → 返回 null（调用方明确跳过）；
                   后端在、文件不在 → **抛错**，那是要红的。

                   **只读、只在门禁里用。** 产品代码不许 import 它——本仓的
                   install / build / e2e 不依赖 `../backend` 的源码布局，
                   依赖的是跑起来的 Gateway 和签入的 `contracts/`。
*/

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** 仓库根下的 backend/。frontend-vue/scripts/lib/ → ../../../ 就是仓库根。 */
export const backendRoot = fileURLToPath(
  new URL("../../../backend/", import.meta.url),
);

/**
 * 读 `backend/<rel>`。
 *
 * @returns 源码文本；`../backend` 整个不在 checkout 里时返回 `null`。
 * @throws  `../backend` 在、而这份文件不在——后端挪了文件，调用方那条断言要跟进。
 */
export function readBackendSource(rel) {
  if (!existsSync(backendRoot)) return null;
  const path = `${backendRoot}${rel}`;
  if (!existsSync(path)) {
    throw new Error(
      `../backend 在 checkout 里，但 ${rel} 不在——后端挪了文件，` +
        `跟进引用它的那条断言（别把这里改成静默跳过）`,
    );
  }
  return readFileSync(path, "utf8");
}
