/*
  【文件职责】     把一个 SSE 帧文本解析成事件帧或心跳注释帧。
  【架构位置】     L1
  【主要导出】     parseSseFrame
  【依赖关系】     ./sse-event
  【边界与注意】   三条规范细节都不是可选的（05 L1/L2/L3）：
                   - 行分隔用 `/\r?\n/`；
                   - `id:` 必须保留——DeerFlow 的重放游标就是 SSE `Last-Event-ID`，
                     丢了它续传只能从头来；
                   - `data:` 后**只剥一个**前导空格，不是 `trim()`。JSON 载荷看不
                     出差别，但流式 token 文本里的前导空格是内容，`trim()` 会吃掉
                     每个 chunk 的首空格，拼出来的句子会粘在一起。

                   无冒号的字段行按规范当作空值字段（`data` 单独一行 = 空 data 行），
                   不是丢弃。
*/

import type { SseFrame } from "./sse-event";

export function parseSseFrame(frame: string): SseFrame | undefined {
  let event = "message";
  let id: string | undefined;
  const dataLines: string[] = [];
  const commentLines: string[] = [];

  for (const rawLine of frame.split(/\r?\n/)) {
    if (rawLine === "") {
      continue;
    }
    if (rawLine.startsWith(":")) {
      commentLines.push(rawLine.slice(1).trimStart());
      continue;
    }

    const separatorIndex = rawLine.indexOf(":");
    const field =
      separatorIndex === -1 ? rawLine : rawLine.slice(0, separatorIndex);
    const rawValue =
      separatorIndex === -1 ? "" : rawLine.slice(separatorIndex + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

    if (field === "event") {
      event = value;
    } else if (field === "data") {
      dataLines.push(value);
    } else if (field === "id") {
      id = value;
    }
  }

  if (dataLines.length === 0) {
    if (commentLines.length > 0) {
      return { kind: "heartbeat", comment: commentLines.join("\n") };
    }
    return undefined;
  }

  return {
    kind: "event",
    event: {
      event,
      data: dataLines.join("\n"),
      ...(id !== undefined ? { id } : {}),
    },
  };
}
