import { describe, expect, it } from "vitest";

import {
  extractMessageAttachments,
  isImageAttachment,
} from "@/core/messages/attachments";
import type { Message } from "@/core/types/message";
import { buildVisibleHistoryMessages } from "@/core/threads/message-identity";

describe("WP-03 persisted message attachments", () => {
  it("reads modern additional_kwargs.files without local composer state", () => {
    const message = {
      type: "human",
      content: "Review these",
      additional_kwargs: {
        files: [
          {
            filename: "diagram.png",
            size: 512,
            path: "/mnt/user-data/uploads/diagram.png",
            status: "uploaded",
          },
          {
            filename: "notes.txt",
            size: 42,
            path: "/mnt/user-data/uploads/notes.txt",
          },
        ],
      },
    } as Message;

    expect(extractMessageAttachments(message)).toHaveLength(2);
    expect(isImageAttachment(extractMessageAttachments(message)[0]!)).toBe(
      true,
    );
    expect(isImageAttachment(extractMessageAttachments(message)[1]!)).toBe(
      false,
    );
  });

  it("carries Gateway page feedback into the rendered message after refresh", () => {
    const [message] = buildVisibleHistoryMessages(
      [
        {
          run_id: "run-1",
          seq: 1,
          content: { id: "ai-1", type: "ai", content: "Done" } as Message,
          feedback: { feedback_id: "fb-1", rating: 1, comment: null },
          metadata: { caller: "lead_agent" },
          created_at: new Date(0).toISOString(),
        } as never,
      ],
      new Set(),
    );
    expect(Reflect.get(message!, "feedback")).toEqual({
      feedback_id: "fb-1",
      rating: 1,
      comment: null,
    });
  });

  it("parses both current and legacy upload context blocks", () => {
    for (const tag of ["current_uploads", "uploaded_files"]) {
      const message = {
        type: "human",
        content: `<${tag}>\n- archive.pdf (2.0 KB)\n  Path: /mnt/user-data/uploads/archive.pdf\n</${tag}>`,
      } as Message;
      expect(extractMessageAttachments(message)).toEqual([
        {
          filename: "archive.pdf",
          size: 2048,
          path: "/mnt/user-data/uploads/archive.pdf",
        },
      ]);
    }
  });

  it("ignores malformed modern metadata instead of inventing fields", () => {
    const message = {
      type: "human",
      content: "hello",
      additional_kwargs: { files: [{ filename: "broken.txt" }] },
    } as unknown as Message;
    expect(extractMessageAttachments(message)).toEqual([]);
  });
});
