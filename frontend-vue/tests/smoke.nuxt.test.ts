/*
  【文件职责】     证明 Vitest Nuxt project 真正加载 Nuxt 环境。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     使用 @nuxt/test-utils runtime
  【边界与注意】   断言具体 app 配置，禁止空测试。
*/

import { describe, expect, it } from "vitest";
import { useRuntimeConfig } from "#imports";

describe("Nuxt test project", () => {
  it("loads the declared public runtime config", () => {
    expect(useRuntimeConfig().public).toHaveProperty("authDisabled");
  });
});
