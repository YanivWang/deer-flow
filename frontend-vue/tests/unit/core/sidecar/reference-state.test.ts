/*
  由 scripts/rstest-to-vitest.mjs 从 frontend/tests/unit/core/sidecar/reference-state.test.ts 机械生成。
  基线 27a425b0 · 改动仅限 @rstest/core → vitest、rs.* → vi.*。
  勿手改：make codemod-check 会红。需要为 Vue 侧适配就登记进 HAND_MAINTAINED。
*/

import { expect, test } from "vitest";

import {
  getNextSidecarOpenState,
  type SidecarReferenceStateItem,
} from "@/core/sidecar/reference-state";

const firstReference: SidecarReferenceStateItem = {
  id: 1,
  context: {
    type: "referenced_message",
    label: "Selected assistant text #1",
    messageId: "msg-1",
    role: "assistant",
    content: "First selected text.",
  },
};

const secondReference: SidecarReferenceStateItem = {
  id: 2,
  context: {
    type: "referenced_message",
    label: "Selected assistant text #1",
    messageId: "msg-1",
    role: "assistant",
    content: "Second selected text.",
  },
};

test("keeps the existing sidecar thread when adding a new reference", () => {
  const nextState = getNextSidecarOpenState({
    open: true,
    sidecarThreadId: "sidecar-thread-1",
    activeReferences: [],
    nextReference: secondReference,
  });

  expect(nextState.sidecarThreadId).toBe("sidecar-thread-1");
  expect(nextState.activeReferences).toEqual([secondReference]);
});

test("accumulates references while drafting a new sidecar thread", () => {
  const nextState = getNextSidecarOpenState({
    open: true,
    sidecarThreadId: null,
    activeReferences: [firstReference],
    nextReference: secondReference,
  });

  expect(nextState.sidecarThreadId).toBeNull();
  expect(nextState.activeReferences).toEqual([firstReference, secondReference]);
});
