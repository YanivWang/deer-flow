/*
  【文件职责】     锁定 Vue Button cva token 来自当前 React Button 源码。
  【对应 frontend/】 frontend/src/components/ui/button.tsx
  【架构位置】     测试
  【主要导出】     Button source-drift cases
  【依赖关系】     读取 React 源文件并消费 Vue buttonVariants
  【边界与注意】   视觉 E2E 比 computed style；本测试负责在 React 源变动时显式报漂移。
*/

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buttonVariants } from "../../app/components/ui/button/variants";

const reactButtonSource = readFileSync(
  new URL("../../../frontend/src/components/ui/button.tsx", import.meta.url),
  "utf8",
);

describe("Button source parity", () => {
  for (const variant of ["default", "outline"] as const) {
    it(`keeps every ${variant} Vue class token in the React source`, () => {
      const tokens = buttonVariants({ variant, size: "default" }).split(" ");
      expect(tokens.length).toBeGreaterThan(10);
      for (const token of tokens) expect(reactButtonSource).toContain(token);
    });
  }
});
