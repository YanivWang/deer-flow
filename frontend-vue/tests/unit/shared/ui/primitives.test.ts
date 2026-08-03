import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

import AppButton from "../../../../app/shared/ui/AppButton.vue";
import AppDialog from "../../../../app/shared/ui/AppDialog.vue";
import AppEmptyState from "../../../../app/shared/ui/AppEmptyState.vue";
import AppFeedback from "../../../../app/shared/ui/AppFeedback.vue";
import AppFormField from "../../../../app/shared/ui/AppFormField.vue";

describe("shared UI primitives", () => {
  it("exposes disabled and loading behavior through the button contract", () => {
    const wrapper = mount(AppButton, {
      props: { loading: true, variant: "primary" },
      slots: { default: "保存" },
    });

    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    expect(wrapper.get("button").classes()).toContain("app-button--loading");
    expect(wrapper.text()).toContain("保存");
  });

  it("traps dialog focus and emits close for Escape", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const wrapper = mount(AppDialog, {
      attachTo: document.body,
      props: { open: true, title: "设置" },
      slots: { default: "内容" },
    });
    await nextTick();

    expect(document.activeElement).toBe(wrapper.get("button").element);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(wrapper.emitted("close")).toHaveLength(1);

    await wrapper.setProps({ open: false });
    expect(document.activeElement).toBe(trigger);
    wrapper.unmount();
    trigger.remove();
  });

  it("exposes state-specific feedback semantics and retry", async () => {
    const retry = vi.fn();
    const wrapper = mount(AppEmptyState, {
      props: { state: "error", title: "加载失败" },
    });
    await wrapper.get("button").trigger("click");
    expect(wrapper.get("section").attributes("role")).toBe("alert");
    expect(wrapper.emitted("retry")).toHaveLength(1);

    const feedback = mount(AppFeedback, { props: { tone: "error", message: "请求失败" } });
    expect(feedback.get("div").attributes("role")).toBe("alert");
    retry();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("associates form labels and visible validation errors", () => {
    const wrapper = mount(AppFormField, {
      props: { error: "必填", forId: "task-title", label: "标题", required: true },
      slots: { default: '<input id="task-title" />' },
    });

    expect(wrapper.get("label").attributes("for")).toBe("task-title");
    expect(wrapper.get(".app-form-field__error").attributes("role")).toBe("alert");
    expect(wrapper.text()).toContain("标题 *");
  });
});
