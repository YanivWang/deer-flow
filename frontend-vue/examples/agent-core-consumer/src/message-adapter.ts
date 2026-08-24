/*
  【文件职责】     示例后端消息与 agent-core AgentMessage 的适配器。
  【架构位置】     consumer L3 adapter
  【主要导出】     ExampleWireMessage · toAgentMessage
  【依赖关系】     只从 @deerflow/agent-core 根入口消费
  【边界与注意】   真实项目应在这里保留自己的未知字段；不要把后端 wire 类型塞进 L1。
*/

import { createAgentMessage } from "@deerflow/agent-core";
import type { AgentMessage } from "@deerflow/agent-core";

export interface ExampleWireMessage {
  message_id: string;
  speaker: "user" | "agent";
  text: string;
  trace_id?: string;
}

export function toAgentMessage(message: ExampleWireMessage): AgentMessage {
  return createAgentMessage(
    message.message_id,
    message.speaker === "user" ? "human" : "assistant",
    {
      content: message.text,
      isStreaming: false,
      meta: {
        wire: message,
        ...(message.trace_id ? { traceId: message.trace_id } : {}),
      },
    },
  );
}
