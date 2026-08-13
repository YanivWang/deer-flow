import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import HumanInputCard from "@/components/chat/HumanInputCard.vue";
import type { HumanInputRequest } from "@/core/messages/human-input";

describe("HumanInputCard", () => {
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
});
