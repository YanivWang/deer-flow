/*
  【文件职责】     判定一个线程 URL 是否该被放弃并退回新会话。
  【架构位置】     L3
  【主要导出】     isThreadMissingError · shouldLeaveMissingThread · ThreadPresence
  【依赖关系】     core/api/errors
  【边界与注意】   线程「存在」的判据不是 checkpoint，而是「后端还能不能给出这段会话」。
                   上下文压缩之后 checkpoint 不再持有旧消息，`GET /threads/{id}` 与
                   `/state` 都会 404，但 `GET /threads/{id}/messages/page` 仍然能完整
                   返回历史。把 404 直接当成「线程不存在」并跳转，等于在用户还能看到
                   自己的对话时把它扔掉——这正是本模块存在的原因。
*/

import { isGatewayResponseError } from "@/core/api/errors";

/** 元数据探测的三种结果。`unknown` 覆盖「还没探测」和「探测本身失败」两种情况。 */
export type ThreadPresence = "unknown" | "present" | "missing";

/**
 * 这个错误是否意味着「线程对当前用户不可见」。
 *
 * 403 与 404 一视同仁：区别对待会泄漏「这个 id 存在但不属于你」。调用方对两者的
 * 处置也完全一样，所以没有必要在前端把它们分开。
 *
 * 其余错误（网络抖动、5xx、解析失败）**不算** missing。把它们也算进来，一次瞬时
 * 500 就会把用户踢回新会话，而且没有任何提示。
 */
export function isThreadMissingError(error: unknown): boolean {
  if (!isGatewayResponseError(error)) return false;
  return error.status === 403 || error.status === 404;
}

export interface ThreadPresenceDecision {
  /** `GET /threads/{id}` 的探测结果。 */
  presence: ThreadPresence;
  /** 历史是否已经取完：既不在加载中，也没有下一页。 */
  historySettled: boolean;
  /** 历史里是否有任何可见消息。 */
  hasMessages: boolean;
}

/**
 * 只有三件事同时成立才放弃这个 URL：元数据确认缺失、历史已经取完、且确实一条都没有。
 *
 * 三个条件缺一不可：
 * - 少了 `presence === "missing"`，一次探测失败就会误伤；
 * - 少了 `historySettled`，会在历史还在路上时就跳走（第一帧永远是空的）；
 * - 少了 `!hasMessages`，就是本模块开头描述的那个缺陷本身。
 */
export function shouldLeaveMissingThread(
  decision: ThreadPresenceDecision,
): boolean {
  return (
    decision.presence === "missing" &&
    decision.historySettled &&
    !decision.hasMessages
  );
}
