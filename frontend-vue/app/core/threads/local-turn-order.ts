/*
  【文件职责】     05 C8 / C9：本地提交回合的顺序锚点。
  【对应 frontend/】 core/threads/hooks.ts
  【架构位置】     L3（纯 TS）
  【主要导出】     restoreLocalTurnMessageOrder
  【依赖关系】     ./message-identity · ../messages/utils · ../types/message
  【边界与注意】   C9 的「保持到 finish / stop / stream error，下次本地提交时替换，
                   切换 thread 或 replay-gap 恢复时清除」**不在这个函数里**——
                   它是基线 set 的生命周期，归 `useThreadStream`。本文件只回答
                   「给定基线，这一帧该怎么排」。

                   两者分开是有代价的（读代码要跳两个文件），但合起来就没法测：
                   基线生命周期要驱动一个流才看得见，而排序规则本身是纯的。
                   上游 `local-turn-order.dom.test.tsx` 需要 React DOM 正是因为
                   那边没分。
*/

import { isHiddenFromUIMessage } from "../messages/utils";
import type { Message } from "../types/message";

import { messageIdentity } from "./message-identity";

/**
 * Keep messages from a locally submitted turn behind that turn's user input.
 * `messages-tuple` events can publish the first AI/tool steps before the
 * `values` event containing the user message. Those steps are not part of the
 * pre-submit baseline, so move only that visible pending segment behind the
 * first new human message without disturbing established history or hidden
 * checkpoint controls. The caller keeps the baseline after stream completion
 * because the transient event order can survive into the settled frame.
 */
export function restoreLocalTurnMessageOrder(
  messages: Message[],
  baselineMessageIdentities: ReadonlySet<string>,
): Message[] {
  const pendingHumanIndex = messages.findIndex((message) => {
    const identity = messageIdentity(message);
    return (
      message.type === "human" &&
      !isHiddenFromUIMessage(message) &&
      identity !== undefined &&
      !baselineMessageIdentities.has(identity)
    );
  });
  if (pendingHumanIndex <= 0) {
    return messages;
  }

  const stablePrefix: Message[] = [];
  const earlyPendingSteps: Message[] = [];
  for (const message of messages.slice(0, pendingHumanIndex)) {
    const identity = messageIdentity(message);
    const isVisiblePendingStep =
      (message.type === "ai" || message.type === "tool") &&
      !isHiddenFromUIMessage(message) &&
      identity !== undefined &&
      !baselineMessageIdentities.has(identity);
    if (isVisiblePendingStep) {
      earlyPendingSteps.push(message);
    } else {
      stablePrefix.push(message);
    }
  }
  if (earlyPendingSteps.length === 0) {
    return messages;
  }

  return [
    ...stablePrefix,
    messages[pendingHumanIndex]!,
    ...earlyPendingSteps,
    ...messages.slice(pendingHumanIndex + 1),
  ];
}
