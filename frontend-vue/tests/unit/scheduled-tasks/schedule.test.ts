/*
  【文件职责】     固定时区候选列表必须包含当前值这一条。
  【架构位置】     纯逻辑测试
  【主要导出】     无；Vitest cases
  【依赖关系】     core/scheduled-tasks/schedule
  【边界与注意】   `Intl.supportedValuesOf("timeZone")` 与 `resolvedOptions().timeZone`
                   是两个来源，实测不一致（前者 418 个区里没有 "UTC"，后者在 TZ=UTC 的
                   机器上正好返回 "UTC"）。选中值不在选项里，Select 的触发器就渲染成空白。
*/
import { describe, expect, it } from "vitest";

import { withCurrentTimezone } from "@/core/scheduled-tasks/schedule";

describe("withCurrentTimezone", () => {
  it("prepends a current value the option source does not carry", () => {
    expect(withCurrentTimezone(["Asia/Shanghai"], "UTC")).toEqual([
      "UTC",
      "Asia/Shanghai",
    ]);
  });

  it("leaves the list alone when the value is already there", () => {
    expect(withCurrentTimezone(["UTC", "Asia/Shanghai"], "UTC")).toEqual([
      "UTC",
      "Asia/Shanghai",
    ]);
  });

  it("does not inject an empty value", () => {
    expect(withCurrentTimezone(["UTC"], "")).toEqual(["UTC"]);
  });

  it("copies rather than aliasing the source list", () => {
    const source = ["UTC"];
    expect(withCurrentTimezone(source, "UTC")).not.toBe(source);
  });
});
