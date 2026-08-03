import { buildHumanInputResponseText, type HumanInputRequest, type HumanInputResponse } from "../../../core/messages/human-input";

export function buildHumanInputSubmission(
  request: HumanInputRequest,
  response: HumanInputResponse,
): { text: string; additionalKwargs: Record<string, unknown> } {
  return {
    additionalKwargs: {
      hide_from_ui: true,
      human_input_response: response,
    },
    text: buildHumanInputResponseText(request, response),
  };
}
