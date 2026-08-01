import { describe, expect, it } from "vitest";

import {
  buildHumanInputFormSubmissionValue,
  buildHumanInputHiddenMessage,
  createHumanInputOptionResponse,
  createHumanInputTextResponse,
  extractHumanInputRequest,
  parseHumanInputRequest,
  type HumanInputRequest,
} from "../../../../app/core/messages/human-input";

describe("human input message helpers", () => {
  it("extracts v1 option requests from ask_clarification tool artifacts", () => {
    const request = extractHumanInputRequest({
      type: "tool",
      artifact: {
        human_input: {
          version: 1,
          kind: "human_input_request",
          source: "ask_clarification",
          request_id: "request-1",
          question: "Choose an approach?",
          input_mode: "choice_with_other",
          options: [{ id: "option-1", label: "Fast", value: "fast" }],
        },
      },
    });

    expect(request?.request_id).toBe("request-1");
    expect(request?.options?.[0]?.value).toBe("fast");
  });

  it("extracts v2 form requests and rejects mismatched versions", () => {
    expect(
      parseHumanInputRequest({
        version: 2,
        kind: "human_input_request",
        source: "ask_clarification",
        request_id: "request-2",
        question: "Fill fields",
        input_mode: "form",
        fields: [{ name: "scope", label: "Scope", type: "text", required: true }],
      }),
    ).toMatchObject({ request_id: "request-2", version: 2 });

    expect(
      parseHumanInputRequest({
        version: 1,
        kind: "human_input_request",
        source: "ask_clarification",
        request_id: "bad",
        question: "Fill fields",
        input_mode: "form",
        fields: [{ name: "scope", label: "Scope", type: "text", required: true }],
      }),
    ).toBeNull();
  });

  it("builds v1 text and option responses plus the hidden reply message", () => {
    const request = humanInputRequest();
    const optionResponse = createHumanInputOptionResponse(request, {
      id: "option-1",
      label: "Fast",
      value: "fast",
    });
    const textResponse = createHumanInputTextResponse(request, "Use the fast path");

    expect(optionResponse).toEqual({
      version: 1,
      kind: "human_input_response",
      source: "ask_clarification",
      request_id: "request-1",
      response_kind: "option",
      option_id: "option-1",
      value: "fast",
    });
    expect(buildHumanInputHiddenMessage(request, textResponse)).toEqual({
      type: "human",
      content: "关于“Choose an approach?”，我的回答是：Use the fast path",
      additional_kwargs: {
        hide_from_ui: true,
        human_input_response: textResponse,
      },
    });
  });

  it("submits v2 form answers as readable v1 text response values", () => {
    const request = {
      ...humanInputRequest(),
      version: 2,
      input_mode: "form",
      fields: [
        { name: "scope", label: "Scope", type: "text", required: true },
        { name: "risky", label: "Risky", type: "checkbox", required: false },
      ],
    } satisfies HumanInputRequest;

    expect(
      buildHumanInputFormSubmissionValue(request, {
        scope: "frontend-vue",
        risky: true,
      }),
    ).toBe('Scope: frontend-vue; Risky: 是 [values: {"scope":"frontend-vue","risky":true}]');
  });
});

function humanInputRequest(): HumanInputRequest {
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
