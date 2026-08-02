import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import HumanInputCard from "../../../../../app/components/workspace/messages/HumanInputCard.vue";
import type { HumanInputRequest } from "../../../../../app/core/messages/human-input";

describe("HumanInputCard", () => {
  it("submits an option response for v1 choice requests", async () => {
    const wrapper = mount(HumanInputCard, {
      props: { request: choiceRequest() },
    });

    await wrapper.get('[data-testid="vue-human-input-option-option-1"]').trigger("click");

    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({
      version: 1,
      kind: "human_input_response",
      source: "ask_clarification",
      request_id: "request-1",
      response_kind: "option",
      option_id: "option-1",
      value: "fast",
    });
  });

  it("validates and submits free-text answers", async () => {
    const wrapper = mount(HumanInputCard, {
      props: {
        request: {
          ...choiceRequest(),
          input_mode: "free_text",
          options: undefined,
        },
      },
    });

    await wrapper.get("form.human-input-card__text").trigger("submit");
    const error = wrapper.get('[data-testid="vue-human-input-error"]');
    expect(error.text()).toBe("请填写答案。");
    expect(error.attributes("role")).toBe("alert");
    expect(error.attributes("id")).toBe("vue-human-input-error-request-1");
    expect(wrapper.get('[data-testid="vue-human-input-text"]').exists()).toBe(true);

    await wrapper.get('[data-testid="vue-human-input-text"]').setValue(" Use safer path ");
    await wrapper.get("form.human-input-card__text").trigger("submit");

    expect(wrapper.emitted("submit")?.[0]?.[0]).toMatchObject({
      response_kind: "text",
      value: "Use safer path",
    });
  });

  it("submits v2 form answers as a v1 text response", async () => {
    const wrapper = mount(HumanInputCard, {
      props: { request: formRequest() },
    });

    await wrapper.get("form.human-input-card__form").trigger("submit");
    expect(wrapper.get('[data-testid="vue-human-input-error"]').text()).toBe(
      "请填写必填字段。",
    );
    expect(wrapper.get('[data-testid="vue-human-input-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="vue-human-input-field-scope"]').exists()).toBe(true);

    await wrapper.get('[data-testid="vue-human-input-field-scope"]').setValue("frontend-vue");
    await wrapper.get('[data-testid="vue-human-input-field-priority"]').setValue("high");
    await wrapper.get("form.human-input-card__form").trigger("submit");

    expect(wrapper.emitted("submit")?.[0]?.[0]).toMatchObject({
      response_kind: "text",
      value:
        'Scope: frontend-vue; Priority: high [values: {"scope":"frontend-vue","priority":"high"}]',
    });
  });
});

function choiceRequest(): HumanInputRequest {
  return {
    version: 1,
    kind: "human_input_request",
    source: "ask_clarification",
    request_id: "request-1",
    question: "Choose an approach?",
    input_mode: "choice_with_other",
    options: [{ id: "option-1", label: "Fast", value: "fast" }],
  };
}

function formRequest(): HumanInputRequest {
  return {
    version: 2,
    kind: "human_input_request",
    source: "ask_clarification",
    request_id: "request-2",
    question: "Fill the fields",
    input_mode: "form",
    fields: [
      { name: "scope", label: "Scope", type: "text", required: true },
      {
        name: "priority",
        label: "Priority",
        type: "select",
        required: true,
        options: [{ id: "high", label: "High", value: "high" }],
      },
    ],
  };
}
