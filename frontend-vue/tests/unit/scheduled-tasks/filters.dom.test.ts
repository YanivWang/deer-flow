/*
  【文件职责】     钉住筛选按钮把「当前筛的是哪一档」念得出来。
  【架构位置】     Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     ScheduledTaskFilters
  【边界与注意】   与 `tests/guards/toggle-variant-pressed.test.ts` **分工不同**：
                   那条守卫是静态的，只看得见「`aria-pressed` 这个属性在不在」，
                   写成 `:aria-pressed="false"` 它照样绿。这里跑一次真渲染，
                   钉的是**值跟着状态走**，而且同组里只有一颗是 true。

                   对照台账（`e2e-parity`）在这一处帮不上忙：它比的是两个应用
                   一不一致，两边一起漏掉同一个属性时三档全是 0 行（线索 238）。
                   React 那一侧钉在 `frontend/tests/e2e/scheduled-tasks.spec.ts`。
*/

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import ScheduledTaskFilters from "@/components/workspace/scheduled-tasks/ScheduledTaskFilters.vue";
import { enUS } from "@/core/i18n/locales/en-US";

function mountFilters(props: { status: string; scheduleType: string }) {
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: { value: enUS } } }));
  return mount(ScheduledTaskFilters, {
    props: props as never,
    global: { mocks: { $i18n: { t: { value: enUS } } } },
  });
}

const pressedOf = (wrapper: ReturnType<typeof mountFilters>) =>
  wrapper
    .findAll("button")
    .filter((button) => button.attributes("aria-pressed") === "true")
    .map((button) => button.text());

describe("ScheduledTaskFilters", () => {
  it("每组只有当前那一档是 pressed", () => {
    const labels = enUS.scheduledTasks.filters;
    const wrapper = mountFilters({ status: "enabled", scheduleType: "cron" });

    // 两组各一颗：状态组的 Enabled、类型组的 Cron。
    expect(pressedOf(wrapper)).toEqual([labels.enabled, labels.cron]);
    // 其余七颗必须显式是 false——**缺属性和 false 不是一回事**，
    // 读屏器只有在属性存在时才会念「未按下」。
    expect(
      wrapper
        .findAll("button")
        .every((button) => button.attributes("aria-pressed") !== undefined),
    ).toBe(true);
    wrapper.unmount();
  });

  it("换一档，pressed 跟着换", async () => {
    const labels = enUS.scheduledTasks.filters;
    const wrapper = mountFilters({ status: "all", scheduleType: "all" });
    expect(pressedOf(wrapper)).toEqual([labels.allStatuses, labels.allTypes]);

    await wrapper.setProps({ status: "failed", scheduleType: "once" });
    expect(pressedOf(wrapper)).toEqual([labels.failed, labels.once]);
    wrapper.unmount();
  });
});
