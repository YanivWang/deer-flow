/*
  由 scripts/rstest-to-vitest.mjs 从 frontend/tests/unit/core/sidecar/reference-metadata.test.ts 机械生成。
  基线 27a425b0 · 改动仅限 @rstest/core → vitest、rs.* → vi.*。
  勿手改：make codemod-check 会红。需要为 Vue 侧适配就登记进 HAND_MAINTAINED。
*/

import { expect, test } from "vitest";

import {
  buildReferenceMessageMetadata,
  readReferenceMessageContexts,
  type SidecarContext,
} from "@/core/sidecar";

const contexts: SidecarContext[] = [
  {
    type: "referenced_message",
    label: "Selected assistant text #2",
    messageId: "parent-ai-1",
    role: "assistant",
    content: "Build it as a side conversation.",
  },
  {
    type: "referenced_message",
    label: "Selected assistant text #2",
    messageId: "parent-ai-1",
    role: "assistant",
    content: "Keep the cited snippets compact.",
  },
];

test("builds visible message reference metadata for selected contexts", () => {
  expect(buildReferenceMessageMetadata(contexts)).toEqual({
    referenced_message_count: 2,
    referenced_message_ids: ["parent-ai-1", "parent-ai-1"],
    referenced_message_roles: ["assistant", "assistant"],
    referenced_message_contexts: [
      {
        label: "Selected assistant text #2",
        message_id: "parent-ai-1",
        role: "assistant",
        content: "Build it as a side conversation.",
      },
      {
        label: "Selected assistant text #2",
        message_id: "parent-ai-1",
        role: "assistant",
        content: "Keep the cited snippets compact.",
      },
    ],
  });
});

test("reads visible message reference metadata defensively", () => {
  expect(
    readReferenceMessageContexts({
      referenced_message_contexts: [
        {
          label: "Selected assistant text #2",
          message_id: "parent-ai-1",
          role: "assistant",
          content: "Build it as a side conversation.",
        },
        {
          label: 42,
          message_id: "ignored",
          role: "assistant",
          content: "Bad reference",
        },
      ],
    }),
  ).toEqual([
    {
      type: "referenced_message",
      label: "Selected assistant text #2",
      messageId: "parent-ai-1",
      role: "assistant",
      content: "Build it as a side conversation.",
    },
  ]);
});
