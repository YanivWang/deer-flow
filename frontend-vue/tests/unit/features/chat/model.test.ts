import { describe, expect, it } from "vitest";

import { buildHumanInputSubmission } from "../../../../app/features/chat/answer-human-input/model";
import { hasEditableMessageId } from "../../../../app/features/chat/edit-regenerate/model";
import { normalizeThreadTitle } from "../../../../app/features/chat/rename-thread/model";
import { composeChatMessage, goalObjectiveFromMessage } from "../../../../app/features/chat/send-message/model";
import { canStopChatRun } from "../../../../app/features/chat/stop-run/model";

describe("chat feature models", () => {
  it("keeps composer command shaping in the send-message feature", () => {
    expect(composeChatMessage("  hello  ", "research")).toBe("/research hello");
    expect(goalObjectiveFromMessage("/goal finish the migration")).toBe("finish the migration");
  });

  it("keeps action guards and title normalization pure", () => {
    expect(canStopChatRun(true)).toBe(true);
    expect(canStopChatRun(false)).toBe(false);
    expect(hasEditableMessageId("message-1")).toBe(true);
    expect(hasEditableMessageId(null)).toBe(false);
    expect(normalizeThreadTitle("  renamed  ")).toBe("renamed");
  });

  it("preserves the human-input wire metadata boundary", () => {
    const submission = buildHumanInputSubmission(
      {
        input_mode: "free_text",
        prompt: "Choose",
        request_id: "request-1",
        title: "Need input",
      },
      { response_kind: "text", value: "approved" },
    );

    expect(submission.additionalKwargs).toEqual({
      hide_from_ui: true,
      human_input_response: { response_kind: "text", value: "approved" },
    });
    expect(submission.text).toContain("approved");
  });
});
