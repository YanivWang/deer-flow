/*
  【文件职责】     把示例后端事件归约成完整 consumer state 与规范化消息。
  【对应 frontend/】 无；M8 consumer 示例
  【架构位置】     consumer L3 adapter
  【主要导出】     ExampleEvent · ExampleState · reduceExampleEvent
  【依赖关系】     @deerflow/agent-core EventReducer · ./message-adapter
  【边界与注意】   reducer 保持纯函数；协议字段适配只发生在本 consumer。
*/

import type { EventReducer, SseEvent } from "@deerflow/agent-core";

import { toAgentMessage, type ExampleWireMessage } from "./message-adapter";

export interface ExampleState {
  title: string;
}

interface SnapshotPayload {
  title: string;
  messages: ExampleWireMessage[];
}

export type ExampleEvent = SseEvent;

export const reduceExampleEvent: EventReducer<ExampleState, ExampleEvent> = (
  event,
) => {
  if (event.event !== "snapshot") return [{ type: "ignore" }];
  const payload = JSON.parse(event.data) as SnapshotPayload;
  return [
    { type: "replace-state", state: { title: payload.title } },
    ...payload.messages.map((message) => ({
      type: "upsert-message" as const,
      message: toAgentMessage(message),
    })),
  ];
};
