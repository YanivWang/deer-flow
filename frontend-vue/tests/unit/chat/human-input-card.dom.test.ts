import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HumanInputCard from "@/components/chat/HumanInputCard.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { HumanInputRequest } from "@/core/messages/human-input";

describe("HumanInputCard", () => {
  beforeEach(() => {
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  it("submits a free-text answer through the structured response contract", async () => {
    const request: HumanInputRequest = {
      version: 1,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "clarification-1",
      question: "Which audience should this target?",
      input_mode: "free_text",
    };
    const wrapper = mount(HumanInputCard, {
      props: { request, active: true, pending: false },
    });

    await wrapper.get("textarea").setValue("Executive leadership");
    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({
      version: 1,
      kind: "human_input_response",
      source: "ask_clarification",
      request_id: "clarification-1",
      response_kind: "text",
      value: "Executive leadership",
    });
  });

  it("does not submit free text while an IME composition or keyCode 229 is active", async () => {
    const request: HumanInputRequest = {
      version: 1,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "clarification-ime",
      question: "请补充说明",
      input_mode: "free_text",
    };
    const wrapper = mount(HumanInputCard, {
      props: { request, active: true, pending: false },
    });
    const textarea = wrapper.get("textarea");
    await textarea.setValue("中文回答");

    await textarea.trigger("compositionstart");
    await textarea.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("submit")).toBeUndefined();

    await textarea.trigger("compositionend");
    await textarea.trigger("keydown", { key: "Enter", keyCode: 229 });
    expect(wrapper.emitted("submit")).toBeUndefined();

    textarea.element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    await nextTick();
    expect(wrapper.emitted("submit")?.[0]?.[0]).toMatchObject({
      request_id: "clarification-ime",
      value: "中文回答",
    });
  });

  it("keeps checkbox defaults explicit and blocks an incomplete required form", async () => {
    const request: HumanInputRequest = {
      version: 2,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "clarification-form",
      question: "Confirm delivery details",
      input_mode: "form",
      fields: [
        {
          name: "approved",
          label: "Approved",
          type: "checkbox",
          required: false,
        },
        { name: "owner", label: "Owner", type: "text", required: true },
      ],
    };
    const wrapper = mount(HumanInputCard, {
      props: { request, active: true, pending: false },
    });

    await wrapper.get("button").trigger("click");
    expect(wrapper.get("[role='alert']").text()).toContain("required");
    expect(wrapper.emitted("submit")).toBeUndefined();

    await wrapper.get("input[type='text']").setValue("Dana");
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("submit")?.[0]?.[0]).toMatchObject({
      request_id: "clarification-form",
      response_kind: "text",
      value:
        'Approved: no; Owner: Dana [values: {"approved":false,"owner":"Dana"}]',
    });
  });

  it("treats a required unchecked checkbox as unsatisfied and keeps form state for retry", async () => {
    const request: HumanInputRequest = {
      version: 2,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "must-agree",
      question: "Confirm the release",
      input_mode: "form",
      fields: [
        { name: "owner", label: "Owner", type: "text", required: true },
        {
          name: "approved",
          label: "I approve this release",
          type: "checkbox",
          required: true,
        },
      ],
    };
    const wrapper = mount(HumanInputCard, {
      props: { request, active: true, pending: false },
    });
    const owner = wrapper.get("input[type='text']");
    await owner.setValue("Dana");
    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("submit")).toBeUndefined();
    expect(
      wrapper.get("input[type='checkbox']").attributes("aria-invalid"),
    ).toBe("true");
    expect((owner.element as HTMLInputElement).value).toBe("Dana");

    await wrapper.get("input[type='checkbox']").setValue(true);
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("submit")?.[0]?.[0]).toMatchObject({
      request_id: "must-agree",
      value:
        'Owner: Dana; I approve this release: yes [values: {"owner":"Dana","approved":true}]',
    });
  });

  it("submits real single-choice and required multi-select schemas", async () => {
    const choice: HumanInputRequest = {
      version: 1,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "choice-1",
      question: "Choose a region",
      input_mode: "single_choice",
      options: [
        { id: "apac", label: "APAC", value: "apac" },
        { id: "emea", label: "EMEA", value: "emea" },
      ],
    };
    const choiceWrapper = mount(HumanInputCard, {
      props: { request: choice, active: true, pending: false },
    });
    await choiceWrapper.findAll("button")[1]!.trigger("click");
    expect(choiceWrapper.emitted("submit")?.[0]?.[0]).toMatchObject({
      response_kind: "option",
      option_id: "emea",
      value: "emea",
    });

    const form: HumanInputRequest = {
      version: 2,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "multi-1",
      question: "Choose channels",
      input_mode: "form",
      fields: [
        { name: "owner", label: "Owner", type: "text", required: true },
        {
          name: "channels",
          label: "Channels",
          type: "multi_select",
          required: true,
          options: [
            { id: "email", label: "Email", value: "email" },
            { id: "web", label: "Web", value: "web" },
          ],
        },
      ],
    };
    const formWrapper = mount(HumanInputCard, {
      props: { request: form, active: true, pending: false },
    });
    await formWrapper.get("input[type='text']").setValue("Dana");
    const select = formWrapper.get("select");
    for (const option of Array.from(
      (select.element as HTMLSelectElement).options,
    )) {
      option.selected = true;
    }
    await select.trigger("change");
    await formWrapper.get("button").trigger("click");
    expect(formWrapper.emitted("submit")?.[0]?.[0]).toMatchObject({
      response_kind: "text",
      value:
        'Owner: Dana; Channels: email, web [values: {"owner":"Dana","channels":["email","web"]}]',
    });
  });
});
