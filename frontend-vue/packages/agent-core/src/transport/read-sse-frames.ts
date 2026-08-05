/*
  【文件职责】     把一个字节流读成 SSE 帧序列：解码、分帧、上限保护、abort、尾帧。
  【对应 frontend/】 无；上游这一层在 SDK 内部
  【架构位置】     L1
  【主要导出】     FrameReaderOptions · readSseFrames
  【依赖关系】     ./sse-buffer · ./parse-sse-event · ../errors
  【边界与注意】   44309ae7 的三个起点文件到这里为止；L4/L5 不在本文件——
                   退避与重试上限是**会话**的事，不是 reader 的事。让一个通用
                   reader 自己重连，它就必然要持有「怎么重新发起请求」，
                   而重新发起 create POST 正是 08 §硬规则 1 禁止的（05 L10）。
                   本文件读完一个 response body 就结束，重连由 run-session 决定。

                   上限（05 L6）按**字节**判，不是按字符：`maxBufferBytes` 的语义
                   是「后端一直不发空行时最多攒多少内存」，而 UTF-16 长度对多字节
                   文本会低估。计数用增量维护（进来加 chunk 字节、出去减掉已消费
                   前缀的字节），避免每个 chunk 重新编码整个缓冲变成 O(n²)。
*/

import { AgentStreamError, toAgentStreamError } from "../errors";

import { parseSseFrame } from "./parse-sse-event";
import { flushSseRemainder, readNextSseFrame } from "./sse-buffer";
import type { SseFrame } from "./sse-event";

export interface FrameReaderOptions {
  maxBufferBytes: number;
  signal?: AbortSignal;
}

/**
 * 惰性读取，`for await` 驱动。
 *
 * 保持惰性而不是先收集再返回：调用方要能在读到 `end` 之后立刻停止拉取，
 * 也要能在 abort 时让 `finally` 跑到 `reader.cancel()`。
 */
export async function* readSseFrames(
  body: ReadableStream<Uint8Array>,
  options: FrameReaderOptions,
): AsyncGenerator<SseFrame> {
  const { maxBufferBytes, signal } = options;

  if (signal?.aborted) {
    throw new AgentStreamError(
      "abort",
      "Stream aborted before the first read.",
    );
  }

  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  const encoder = new TextEncoder();

  // reader.read() 不看 signal，所以要主动 cancel 把它从挂起里拉出来。
  const onAbort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  let buffer = "";
  let pendingBytes = 0;

  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (error) {
        // 读到一半连接断了。abort 由下面的 signal 检查认领，其余归 network——
        // 它是唯一有退避重连资格的一类（见 ../errors）。
        if (signal?.aborted) {
          throw new AgentStreamError("abort", "Stream aborted while reading.", {
            cause: error,
          });
        }
        throw toAgentStreamError(error, "network");
      }

      if (signal?.aborted) {
        throw new AgentStreamError("abort", "Stream aborted while reading.");
      }

      if (chunk.done) break;

      // `{ stream: true }` 是跨 chunk UTF-8 的全部要害：一个汉字被切在两个
      // chunk 之间时，不带这个选项会当场解成替换字符，且**无法回滚**。
      buffer += decoder.decode(chunk.value, { stream: true });
      pendingBytes += chunk.value.byteLength;

      if (pendingBytes > maxBufferBytes) {
        throw new AgentStreamError(
          "parse_error",
          `SSE buffer exceeded ${maxBufferBytes} bytes without a frame separator.`,
        );
      }

      while (true) {
        const next = readNextSseFrame(buffer);
        if (!next) break;
        pendingBytes -= encoder.encode(
          buffer.slice(0, buffer.length - next.remaining.length),
        ).length;
        buffer = next.remaining;

        const frame = parseSseFrame(next.frame);
        if (frame) yield frame;
      }
    }

    // decoder 里可能还压着一个不完整的多字节序列；不 flush 就会静默丢字符。
    buffer += decoder.decode();
    const remainder = flushSseRemainder(buffer);
    if (remainder !== undefined) {
      const frame = parseSseFrame(remainder);
      if (frame) yield frame;
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    // 消费方提前 break 出 for-await 时也要走到这里，否则连接一直挂着。
    await reader.cancel().catch(() => {});
  }
}
