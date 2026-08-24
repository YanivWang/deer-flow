/*
  【文件职责】     SSE 帧的形状：事件帧与心跳注释帧。
  【架构位置】     L1
  【主要导出】     SseEvent · SseFrame
  【依赖关系】     无
  【边界与注意】   心跳是**帧的一种**，不是「解析失败」。44309ae7 那版已经做对了；
                   把它变成 `parse() → undefined` 会让心跳在类型层消失，
                   看门狗（05 L9）随后把有心跳的连接误判成静默。

                   名字跟 08 走（`SseEvent`），不是 44309ae7 的 `ParsedSseEvent`——
                   合同文档是唯一来源，起点代码只提供实现。
*/

export interface SseEvent {
  event: string;
  data: string;
  id?: string;
}

export type SseFrame =
  { kind: "event"; event: SseEvent } | { kind: "heartbeat"; comment: string };
