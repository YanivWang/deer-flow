import { expect, test } from "vitest";

import { channelSourceOfThread } from "@/core/threads/utils";

test("labels Buzz channel threads with the product provider name", () => {
  expect(
    channelSourceOfThread({
      metadata: {
        channel_source: {
          type: "im_channel",
          provider: "buzz",
          chat_id: "buzz-room",
        },
      },
    }),
  ).toEqual({ type: "im_channel", provider: "buzz", label: "Buzz" });
});
