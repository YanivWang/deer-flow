/*
  【文件职责】     SSE 分帧层的行为，逐条对应 05 L 组。
  【对应 frontend/】 无；上游这一层在 SDK 内部，没有可搬的测试
  【架构位置】     L1 测试
  【主要导出】     无
  【依赖关系】     ../src/transport/* · ./helpers
  【边界与注意】   每个 it 的标题带 L 编号，是为了让「改坏了哪条不变式」在测试
                   输出里直接可读，而不用回头翻 05。删标题里的编号等于删掉这条
                   追溯链。

                   这里**不测**重连与退避：那是会话的事，在 run-session.test.ts。
                   分帧层读完一个 body 就结束，它不认识「还有下一次请求」。
*/

import { describe, expect, it } from "vitest";

import { AgentStreamError } from "../src/errors";
import { parseSseFrame } from "../src/transport/parse-sse-event";
import { readSseFrames } from "../src/transport/read-sse-frames";
import {
  flushSseRemainder,
  readNextSseFrame,
} from "../src/transport/sse-buffer";

import { bytesOf, collect, pendingStream, streamOf } from "./helpers";

const BIG = 1024 * 1024;

const eventsOf = async (chunks: readonly (string | Uint8Array)[]) =>
  collect(readSseFrames(streamOf(chunks), { maxBufferBytes: BIG }));

describe("分帧（05 L1）", () => {
  it("L1：CRLF 分隔的帧与 LF 一样能切出来", async () => {
    const frames = await eventsOf([
      "event: a\r\ndata: 1\r\n\r\nevent: b\r\ndata: 2\r\n\r\n",
    ]);
    expect(frames).toEqual([
      { kind: "event", event: { event: "a", data: "1" } },
      { kind: "event", event: { event: "b", data: "2" } },
    ]);
  });

  it("L1：LF 与 CRLF 混在同一条流里也不会卡住", async () => {
    const frames = await eventsOf(["event: a\ndata: 1\r\n\r\ndata: 2\n\n"]);
    expect(
      frames.map((f) => (f.kind === "event" ? f.event.data : null)),
    ).toEqual(["1", "2"]);
  });

  it("分隔符被切在两个 chunk 之间仍然算一帧", async () => {
    // 这是只在特定切分下才出现的一类：buffer 里先只有 "\r\n"，
    // 下一个 chunk 才补上后半个分隔符。
    const frames = await eventsOf(["data: 1\r\n", "\r\ndata: 2\n\n"]);
    expect(frames).toHaveLength(2);
  });
});

describe("字段解析（05 L2 / L3 / L9）", () => {
  it("L2：`id:` 必须带出来——DeerFlow 的重放游标就是它", async () => {
    const frames = await eventsOf(["event: values\ndata: {}\nid: 1785-42\n\n"]);
    expect(frames[0]).toEqual({
      kind: "event",
      event: { event: "values", data: "{}", id: "1785-42" },
    });
  });

  it("L3：`data:` 只剥一个前导空格，不是 trim", () => {
    const frame = parseSseFrame("data:   两侧都有空格   ");
    expect(frame).toEqual({
      kind: "event",
      event: { event: "message", data: "  两侧都有空格   " },
    });
  });

  it("L3：token 文本的前导空格是内容，不能被吃掉", async () => {
    // 真实症状：trim 之后每个 chunk 的首空格没了，拼出来是「hello.world」。
    const frames = await eventsOf(["data:  world\n\n"]);
    expect(frames[0]).toMatchObject({ event: { data: " world" } });
  });

  it("L9：以 `:` 开头的注释是心跳帧，不是空事件", async () => {
    const frames = await eventsOf([": heartbeat\n\n", "data: 1\n\n"]);
    expect(frames[0]).toEqual({ kind: "heartbeat", comment: "heartbeat" });
    expect(frames[1]?.kind).toBe("event");
  });

  it("多行 data 按换行拼接", () => {
    expect(parseSseFrame("data: a\ndata: b\ndata: c")).toMatchObject({
      event: { data: "a\nb\nc" },
    });
  });

  it("无冒号的字段行按规范当作空值字段", () => {
    // 裸 `data` 一行 = 一个空的 data 行，所以这一帧**有** data，只是它是空串。
    expect(parseSseFrame("data")).toEqual({
      kind: "event",
      event: { event: "message", data: "" },
    });
  });

  it("event 缺省是 message", () => {
    expect(parseSseFrame("data: x")).toMatchObject({
      event: { event: "message" },
    });
  });

  it("既没有 data 也没有注释的帧不产出任何东西", () => {
    expect(parseSseFrame("id: 7")).toBeUndefined();
  });
});

describe("缓冲原语", () => {
  it("没有分隔符时切不出帧", () => {
    expect(readNextSseFrame("data: 1\n")).toBeUndefined();
  });

  it("flush 只剥一个尾随换行", () => {
    expect(flushSseRemainder("data: 1\n")).toBe("data: 1");
    expect(flushSseRemainder("\n")).toBeUndefined();
    expect(flushSseRemainder("")).toBeUndefined();
  });
});

describe("流末与跨 chunk", () => {
  it("流末没有空行时最后一帧仍然产出", async () => {
    // 实测 DeerFlow 的 `end` 帧就是这个形状：`data: null` 后面只有一个换行。
    const frames = await eventsOf(["event: end\ndata: null\n"]);
    expect(frames).toEqual([
      { kind: "event", event: { event: "end", data: "null" } },
    ]);
  });

  it("多字节字符被切在两个 chunk 之间不会变成替换字符", async () => {
    const raw = bytesOf("data: 中文\n\n");
    // 「中」的三个字节里切一刀。不带 { stream: true } 的解码在这里会
    // 当场产出 U+FFFD，而且**无法回滚**——后面拼得再对也救不回来。
    const cut = 8;
    const frames = await eventsOf([raw.slice(0, cut), raw.slice(cut)]);
    expect(frames[0]).toMatchObject({ event: { data: "中文" } });
  });
});

describe("上限与中止（05 L6）", () => {
  it("L6：后端一直不发分隔空行时按字节数触发上限", async () => {
    await expect(
      collect(
        readSseFrames(streamOf(["data: " + "x".repeat(300)]), {
          maxBufferBytes: 128,
        }),
      ),
    ).rejects.toMatchObject({
      kind: "parse_error",
      retryable: false,
    });
  });

  it("L6：上限按字节而不是按 UTF-16 长度", async () => {
    // 64 个汉字 = 64 个 UTF-16 单位，但 192 字节。按长度判会放过它。
    const text = "字".repeat(64);
    await expect(
      collect(
        readSseFrames(streamOf(["data: " + text]), { maxBufferBytes: 100 }),
      ),
    ).rejects.toBeInstanceOf(AgentStreamError);
  });

  it("上限只管未成帧的残留，正常长流不会误触发", async () => {
    const body = Array.from({ length: 50 }, (_, i) => `data: ${i}\n\n`).join(
      "",
    );
    const frames = await collect(
      readSseFrames(streamOf([body]), { maxBufferBytes: 64 }),
    );
    expect(frames).toHaveLength(50);
  });

  it("已经 aborted 的 signal 直接抛，不去开读", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      collect(
        readSseFrames(pendingStream(), {
          maxBufferBytes: BIG,
          signal: controller.signal,
        }),
      ),
    ).rejects.toMatchObject({ kind: "abort", retryable: false });
  });

  it("读到一半 abort 会中止而不是静默结束", async () => {
    const controller = new AbortController();
    const frames = readSseFrames(pendingStream(["data: 1\n\n"]), {
      maxBufferBytes: BIG,
      signal: controller.signal,
    });
    const iterator = frames[Symbol.asyncIterator]();
    expect(await iterator.next()).toMatchObject({
      value: { kind: "event" },
    });
    controller.abort();
    await expect(iterator.next()).rejects.toMatchObject({ kind: "abort" });
  });

  it("消费方提前 break 也要释放读取器", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytesOf("data: 1\n\n"));
      },
      cancel() {
        cancelled = true;
      },
    });
    for await (const _frame of readSseFrames(body, { maxBufferBytes: BIG })) {
      break;
    }
    expect(cancelled).toBe(true);
  });
});
