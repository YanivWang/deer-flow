/*
  【文件职责】     从字符缓冲里切出一个完整 SSE 帧，并在流末交回残留。
  【对应 frontend/】 无；起点是 44309ae7 的 app/core/api/stream/transport/sse-buffer.ts
  【架构位置】     L1
  【主要导出】     readNextSseFrame · flushSseRemainder
  【依赖关系】     无
  【边界与注意】   分隔符是 `/\r?\n\r?\n/` 而不是 `"\n\n"`（05 L1）。DeerFlow 经
                   nginx，代理一旦发出 CRLF，只找 `\n\n` 的实现会永远攒不出帧——
                   表现是「流卡住但连接还在」，最难查的一类。

                   本层只切字符串，不认识 `data:`/`event:`。buffer 上限归
                   read-sse-frames.ts 管：上限要按**字节**判（05 L6），
                   而这里拿到的已经是解码后的字符。
*/

export interface SseBufferResult {
  frame: string;
  remaining: string;
}

const FRAME_SEPARATOR = /\r?\n\r?\n/;

export function readNextSseFrame(buffer: string): SseBufferResult | undefined {
  const match = FRAME_SEPARATOR.exec(buffer);
  if (!match || match.index < 0) {
    return undefined;
  }

  const separatorLength = match[0].length;
  return {
    frame: buffer.slice(0, match.index),
    remaining: buffer.slice(match.index + separatorLength),
  };
}

/**
 * 流结束时缓冲里还剩的东西。
 *
 * 后端在最后一帧后不发空行是常见的（实测 DeerFlow 的 `end` 帧就带着尾随换行
 * 结束），把它丢掉等于丢掉终止信号。
 */
export function flushSseRemainder(buffer: string): string | undefined {
  const trimmed = buffer.replace(/\r?\n$/, "");
  return trimmed.length > 0 ? trimmed : undefined;
}
